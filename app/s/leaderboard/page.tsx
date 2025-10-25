"use client";
import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, DocumentData } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";

const LeaderboardPage = () => {
  const [leaderboard, setLeaderboard] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "players"), orderBy("score", "desc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => doc.data());
        setLeaderboard(data);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

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

  return (
    <div className="relative min-h-screen text-white p-4 sm:p-6 md:p-8">
      <div className="absolute inset-0 -z-10 h-full w-full items-center px-5 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]" />
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-center mb-8">
          <Trophy className="w-10 h-10 text-yellow-400 mr-4" />
          <h1 className="text-4xl font-bold">Leaderboard</h1>
        </header>

        <Card className="bg-white/10 border border-gray-200/20 backdrop-blur-lg rounded-2xl shadow-lg">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200/20">
                    <th className="p-4 text-lg font-semibold">Rank</th>
                    <th className="p-4 text-lg font-semibold">Player</th>
                    <th className="p-4 text-lg font-semibold">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((player, index) => (
                    <tr key={player.authUid} className="border-b border-gray-200/20 last:border-b-0 hover:bg-white/5 transition-colors">
                      <td className="p-4 text-lg font-bold">{index + 1}</td>
                      <td className="p-4 text-lg">
                        <div className="flex items-center gap-4">
                          <img
                            src={`https://robohash.org/${player.username}`}
                            alt={player.username}
                            className="w-12 h-12 rounded-full border-2 border-sky-500/50"
                          />
                          <span>{player.username}</span>
                        </div>
                      </td>
                      <td className="p-4 text-lg font-bold text-yellow-400">{player.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LeaderboardPage;
