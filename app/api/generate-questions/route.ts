// app/api/generate-questions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getJson } from "serpapi";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    // Get the authorization token from headers
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Get the UID from the request body
    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Fetch company data from Firestore
    const companyQuery = query(
      collection(db, 'company'),
      where('authUid', '==', uid)
    );
    const querySnapshot = await getDocs(companyQuery);

    if (querySnapshot.empty) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 });
    }

    const companyDoc = querySnapshot.docs[0];
    const companyData = companyDoc.data();
    const companyId = companyDoc.id;

    const {
      website,
      companyDescription,
      numberOfQuestions,
      companyName
    } = companyData;

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
    });

    let searchContext = "";
    try {
        const serpResults = await getJson({
            engine: "google",
            q: `What is the business model of ${companyName}?`,
            api_key: process.env.SERP_API_KEY
        });
        if (serpResults.organic_results) {
            searchContext = serpResults.organic_results.map((r: any) => r.snippet).slice(0, 5).join('\\n');
        }
    } catch (error) {
        console.error("SERP API error:", error);
    }

    

    const prompt = `
You are an expert question generator for company assessments. I need you to research and analyze the following company thoroughly, then generate exactly ${numberOfQuestions} insightful, relevant questions. Each question must be answerable with a single word. You must also provide the correct single-word answer for each question.

Company Information:
- Company Name: ${companyName}
- Website: ${website}
- Company Description: ${companyDescription}

Web Search Context:
Here is some context from a web search about the company:
${searchContext}

Instructions:
1. First, analyze the provided Web Search Context and the company's website (${website}) to understand their business, services, products, and operations.
2. Use all available information to understand their domain.
3. Generate exactly ${numberOfQuestions} questions.
4. Each question must be answerable with a single word.
5. For each question, provide a correct, single-word answer.
6. The answer must be in lowercase.
7. Questions should be relevant to the company's business, services, or domain.
8. When referring to the company, always use its name, '${companyName}', instead of pronouns like 'they' or 'it'.

Format your response ONLY as a JSON array with this exact structure:
[
  {
    "question": "The question text here",
    "answer": "thesinglewordanswer"
  }
]

IMPORTANT: Respond ONLY with the JSON array, no additional text or explanation.
`;

    let generatedQuestions;
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();      
      // Parse the JSON response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        generatedQuestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse JSON from Gemini response');
      }

      // Validate we got the right number of questions
      if (generatedQuestions.length !== parseInt(numberOfQuestions)) {
        console.warn(`Expected ${numberOfQuestions} questions but got ${generatedQuestions.length}`);
      }

    } catch (error) {
      console.error('Error generating questions with Gemini:', error);
      return NextResponse.json(
        { error: 'Failed to generate questions with AI. Please try again.' },
        { status: 500 }
      );
    }

    // Save questions to Firestore
    const questionsCollection = collection(db, 'questions');
    const savedQuestions = [];

    for (const q of generatedQuestions) {
      try {
        const docRef = await addDoc(questionsCollection, {
          companyId: companyId,
          companyName: companyName,
          question: q.question,
          answer: q.answer.toLowerCase(),
          createdAt: serverTimestamp(),
          viewCount: 0,
        });
        savedQuestions.push({ id: docRef.id, ...q });
      } catch (error) {
        console.error('Error saving question:', error);
      }
    }

    if (savedQuestions.length > 0) {
      const companyDocRef = doc(db, 'company', companyId);
      const questionsAndAnswers = generatedQuestions.map((q: any) => ({
        question: q.question,
        answer: q.answer.toLowerCase(),
      }));
      await updateDoc(companyDocRef, {
        questionsGenerated: true,
        questions: questionsAndAnswers,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully generated and saved ${savedQuestions.length} questions`,
      questions: savedQuestions
    });

  } catch (error) {
    console.error('Error in generate-questions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}