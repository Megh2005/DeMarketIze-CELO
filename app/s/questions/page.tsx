"use client";

import React, { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  DocumentData,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  collection,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const QuestionsPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [questions, setQuestions] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const companyQuery = query(
          collection(db, "company"),
          where("authUid", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(companyQuery);
        if (!querySnapshot.empty) {
          const companyDoc = querySnapshot.docs[0];
          if (companyDoc.data().questions) {
            const questionsQuery = query(
              collection(db, "questions"),
              where("companyId", "==", companyDoc.id)
            );
            const questionsSnapshot = await getDocs(questionsQuery);
            const questionsData = questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setQuestions(questionsData);
          }
        }
        setLoading(false);
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleQuestionChange = (
    index: number,
    field: "question" | "answer",
    value: string
  ) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const handleSaveChanges = async () => {
    if (!user) return;
    setSaving(true);
    try {
      for (const q of questions) {
        const questionRef = doc(db, "questions", q.id);
        await updateDoc(questionRef, {
          question: q.question,
          answer: q.answer.toLowerCase(),
        });
      }
      toast.success("Questions saved successfully!");
    } catch (error) {
      toast.error("Failed to save questions.");
      console.error("Error saving questions:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-4">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        </div>
    );
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white"><p>Please log in to see your questions.</p></div>;
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center text-white p-4 md:p-8">
      <div className="absolute inset-0 -z-10 h-full w-full items-center px-5 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]" />
      <div className="max-w-screen mx-auto">
        <h1 className="text-5xl font-bold text-center mb-12 text-sky-400">Your Generated Questions</h1>
        {questions.length > 0 ? (
          <Carousel className="w-full max-w-4xl mx-auto" opts={{
            loop: true,
          }}>
            <CarouselContent>
              {questions.map((q, index) => (
                <CarouselItem key={index}>
                  <div className="p-4">
                    <Card className="bg-white/10 border border-gray-200/20 backdrop-blur-lg rounded-lg shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-lg font-semibold flex justify-between items-center">
                          <span>Question {index + 1}</span>
                          <Badge>{q.viewCount} views</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label htmlFor={`question-${index}`}>Question</Label>
                          <Input
                            id={`question-${index}`}
                            value={q.question}
                            onChange={(e) =>
                              handleQuestionChange(
                                index,
                                "question",
                                e.target.value
                              )
                            }
                            className="bg-gray-700 border-gray-600 text-white mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`answer-${index}`}>Answer</Label>
                          <Input
                            id={`answer-${index}`}
                            value={q.answer}
                            onChange={(e) =>
                              handleQuestionChange(index, "answer", e.target.value)
                            }
                            className="bg-gray-700 border-gray-600 text-white mt-1"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        ) : (
          <div className="flex justify-center items-center h-64">
            <p className="text-center text-gray-400">No questions generated yet.</p>
          </div>
        )}
        <div className="text-center mt-8">
          <Button onClick={handleSaveChanges} disabled={saving || questions.length === 0}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuestionsPage;