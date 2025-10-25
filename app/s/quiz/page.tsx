"use client";
import React, { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  increment,
  arrayUnion,
  DocumentData,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";

const QuizPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [playerData, setPlayerData] = useState<DocumentData | null>(null);
  const [playerDocId, setPlayerDocId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [isGameOver, setIsGameOver] = useState(false);
  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchPlayerDataAndQuestions = async () => {
      if (user) {
        setLoading(true);
        try {
          // Fetch player data
          const playerQuery = query(
            collection(db, "players"),
            where("authUid", "==", user.uid)
          );
          const playerSnapshot = await getDocs(playerQuery);
          if (!playerSnapshot.empty) {
            const doc = playerSnapshot.docs[0];
            setPlayerData(doc.data());
            setPlayerDocId(doc.id);

            const answeredQuestions = doc.data().answeredQuestions || [];

            // Fetch all questions
            const questionsQuery = query(collection(db, "questions"));
            const questionsSnapshot = await getDocs(questionsQuery);
            const allQuestions = questionsSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));

            // Filter out answered questions
            const unansweredQuestions = allQuestions.filter(
              (q) => !answeredQuestions.includes(q.id)
            );

            // Shuffle the unanswered questions
            const shuffledQuestions = [...unansweredQuestions];
            for (let i = shuffledQuestions.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffledQuestions[i], shuffledQuestions[j]] = [
                shuffledQuestions[j],
                shuffledQuestions[i],
              ];
            }

            setQuestions(shuffledQuestions);

            if (shuffledQuestions.length > 0) {
              incrementViewCount(shuffledQuestions[0].id);
            } else {
              toast.info("You have answered all the questions!");
              router.push("/s/player-dashboard");
            }
          } else {
            toast.error("Player data not found.");
            router.push("/s/player-dashboard");
          }
        } catch (error) {
          console.error("Error fetching data:", error);
          toast.error("Failed to fetch data.");
        } finally {
          setLoading(false);
        }
      }
    };
    fetchPlayerDataAndQuestions();
  }, [user, router]);

  const incrementViewCount = async (questionId: string) => {
    const questionRef = doc(db, "questions", questionId);
    await updateDoc(questionRef, {
      viewCount: increment(1),
    });
  };

  const handleNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentQuestionIndex(nextIndex);
      incrementViewCount(questions[nextIndex].id);
      setUserAnswer("");
    } else {
      toast.success("You have completed the quiz!");
      router.push("/s/player-dashboard");
    }
  };

  const handleSubmitAnswer = async () => {
    if (!playerDocId) return;

    const currentQuestion = questions[currentQuestionIndex];
    const playerRef = doc(db, "players", playerDocId);

    if (userAnswer.toLowerCase() === currentQuestion.answer.toLowerCase()) {
      // Correct answer
      const newScore = (playerData?.score || 0) + 1;
      const newAnswered = (playerData?.answered || 0) + 1;
      await updateDoc(playerRef, {
        score: newScore,
        answered: newAnswered,
        answeredQuestions: arrayUnion(currentQuestion.id),
      });
      setPlayerData({ ...playerData, score: newScore, answered: newAnswered });

      if (playerData && newAnswered >= playerData.assignedQuestions) {
        setIsQuizComplete(true);
        toast.success("Congratulations! You have completed the quiz.");
      } else {
        toast.success("Correct answer! +1 point.");
        handleNextQuestion();
      }
    } else {
      // Wrong answer
      const newScore = (playerData?.score || 0) - 0.25;
      const newLives = (playerData?.life || 0) - 1;
      await updateDoc(playerRef, {
        score: newScore,
        life: newLives,
      });
      setPlayerData({ ...playerData, score: newScore, life: newLives });
      if (newLives <= 0) {
        setIsGameOver(true);
        toast.error("Game Over! You have run out of lives.");
      } else {
        toast.error("Wrong answer! -0.25 points, -1 life.");
      }
    }
    setUserAnswer("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-1/4" />
        </div>
      </div>
    );
  }

  if (!user || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <p>No more questions available for the quiz.</p>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center text-white p-4 md:p-8">
      <div className="absolute inset-0 -z-10 h-full w-full items-center px-5 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]" />
      <Card className="w-full max-w-2xl bg-white/10 border border-gray-200/20 backdrop-blur-lg rounded-lg shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img
                src={`https://robohash.org/${playerData?.username}`}
                alt={playerData?.username}
                className="w-12 h-12 rounded-full border-2 border-sky-500/50"
              />
              <div>
                <p className="text-lg font-semibold">{playerData?.username}</p>
                <p className="text-sm text-gray-400">Playing Quiz</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-400">Score</p>
                <p className="font-bold text-2xl">{playerData?.score}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-400">Lives</p>
                <p className="font-bold text-2xl">{playerData?.life}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <p className="text-lg text-center font-semibold">
            Question {currentQuestionIndex + 1}
          </p>
          <p className="text-lg">{currentQuestion.question}</p>
          <div className="flex gap-2">
            <Input
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Your answer..."
              className="bg-gray-700 border-gray-600 text-white"
              disabled={isGameOver}
            />
            <Button onClick={handleSubmitAnswer} disabled={isGameOver}>
              Submit
            </Button>
          </div>
        </CardContent>
      </Card>
      {isGameOver && (
        <motion.div
          className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-red-500/20 to-purple-600/20 border border-red-500/50 backdrop-blur-lg rounded-2xl shadow-2xl text-white p-8 w-full max-w-md">
            <CardHeader className="text-center">
              <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <CardTitle className="text-6xl font-bold text-red-400 tracking-wider">
                  GAME OVER
                </CardTitle>
              </motion.div>
            </CardHeader>
            <CardContent className="text-center mt-4 flex flex-col items-center gap-8">
              <motion.div
                className="w-48 h-48 relative"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <Image
                  src="https://robohash.org/meme.png?set=set4"
                  alt="Game Over Meme"
                  layout="fill"
                  objectFit="cover"
                  className="rounded-lg"
                />
              </motion.div>
              <motion.p
                className="text-xl mb-6 text-gray-300"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                You have run out of lives.
              </motion.p>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <Button
                  onClick={() => router.push("/s/player-dashboard")}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-8 rounded-full transition-all duration-300 shadow-lg hover:shadow-red-500/50"
                >
                  Back to Dashboard
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      )}
      {isQuizComplete && (
        <motion.div
          className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-green-500/20 to-blue-600/20 border border-green-500/50 backdrop-blur-lg rounded-2xl shadow-2xl text-white p-8 w-full max-w-2xl">
            <CardHeader className="text-center">
              <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <CardTitle className="text-5xl font-bold text-green-400 tracking-wider">
                  SUCCESS!
                </CardTitle>
              </motion.div>
            </CardHeader>
            <CardContent className="text-center mt-4 flex flex-col md:flex-row items-center gap-8">
              <motion.div
                className="w-48 h-48 bg-gray-700 rounded-lg flex-shrink-0"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                {/* Placeholder for meme image */}
              </motion.div>
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <p className="text-lg text-gray-300 mb-6">
                  You have conquered the quiz! Your knowledge is legendary. Now,
                  go forth and share your epic tale of victory!
                </p>
                <Button
                  onClick={() => router.push("/s/player-dashboard")}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-full transition-all duration-300 shadow-lg hover:shadow-green-500/50"
                >
                  Claim Your Glory
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default QuizPage;
