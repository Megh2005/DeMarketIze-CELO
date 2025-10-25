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
You are a master strategist and business analyst. Your task is to generate exceptionally insightful questions about a company, based on deep analysis of its website and business model. These questions should be answerable with a single, precise word, revealing a core aspect of the company's strategy, market positioning, or unique value proposition.

Company Information:
- Company Name: ${companyName}
- Website: ${website}
- Company Description: ${companyDescription}

Web Search Context:
${searchContext}

Instructions:
1.  **Deep Analysis:** Thoroughly analyze the company's website (${website}) and the provided web search context. Go beyond surface-level information. Synthesize the data to understand the company's core business, its target audience, its revenue model, and what makes it unique.
2.  **Generate Core Questions:** Create exactly ${numberOfQuestions} questions that cut to the heart of the company's operations. Think about what a competitor, investor, or a brilliant new hire would need to know.
3.  **Single-Word Answers:** Each question MUST be answerable with a single, specific word. This word should be a key term, a brand name, a core value, or a critical metric.
4.  **Provide the Answer:** For each question, provide the correct single-word answer in lowercase.
5.  **Avoid Generic Questions:** Do NOT ask questions that could apply to any company (e.g., "What is the company's goal?"). The questions must be specific to '${companyName}'.
6.  **Use Company Name:** When referring to the company, always use its name, '${companyName}'.

**Example of a GOOD Question (for a fictional company 'Innovatech'):**
*   Question: "What is the core methodology that drives Innovatech's product development?"
*   Answer: "agile"

**Example of a BAD Question:**
*   Question: "Does Innovatech value its customers?"
*   Answer: "yes"

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