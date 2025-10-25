"use client";
import React, { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  DocumentData,
  doc,
  updateDoc,
} from "firebase/firestore";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";
import { ABI } from "@/types/contracts";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Heart,
  HelpCircle,
  LogOut,
  Mail,
  Star,
  User as UserIcon,
  Wallet,
  ArrowRight,
} from "lucide-react";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;

const PlayerDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [playerData, setPlayerData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [playerDocId, setPlayerDocId] = useState<string | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [stakingLoading, setStakingLoading] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const q = query(
            collection(db, "players"),
            where("authUid", "==", currentUser.uid)
          );
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            setPlayerData(doc.data());
            setPlayerDocId(doc.id);
          } else {
            setPlayerData(null);
          }
        } catch (error) {
          console.error("Error fetching player data:", error);
          toast.error("Failed to fetch player data.");
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setPlayerData(null);
        setLoading(false);
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const initializeProvider = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const web3Provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await web3Provider.send("eth_accounts", []);
          if (accounts.length > 0) {
            const signerInstance = await web3Provider.getSigner();
            const contractInstance = new ethers.Contract(
              CONTRACT_ADDRESS,
              ABI,
              signerInstance
            );
            setContract(contractInstance);
          }
        } catch (err) {
          console.error(err);
        }
      }
    };
    initializeProvider();
  }, []);

  const handleLogout = async () => {
    const toastId = toast.loading("Logging out...");
    try {
      await signOut(auth);
      toast.success("Logged out successfully!", { id: toastId });
      router.push("/");
    } catch (error) {
      console.error("Logout Error:", error);
      toast.error("Failed to log out.", { id: toastId });
    }
  };

  const stake = async (contractInstance: ethers.Contract) => {
    const toastId = toast.loading("Staking 1 CELO...");
    try {
      setStakingLoading(true);
      const tx = await contractInstance.stake({
        value: ethers.parseEther("1"),
      });
      await tx.wait();
      if (playerDocId) {
        const playerRef = doc(db, "players", playerDocId);
        await updateDoc(playerRef, { isStaked: true });
        setPlayerData((prev) => (prev ? { ...prev, isStaked: true } : null));
      }
      toast.success("Staking successful!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Staking failed.", { id: toastId });
    } finally {
      setStakingLoading(false);
    }
  };

  const handleStake = async () => {
    if (!contract) {
      try {
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        await web3Provider.send("eth_requestAccounts", []);
        const signerInstance = await web3Provider.getSigner();
        const contractInstance = new ethers.Contract(
          CONTRACT_ADDRESS,
          ABI,
          signerInstance
        );
        setContract(contractInstance);
        await stake(contractInstance);
      } catch (err) {
        console.error(err);
        toast.error("Failed to connect wallet.");
      }
      return;
    }
    await stake(contract);
  };

  if (loading) {
    return (
      <div className="relative min-h-screen text-white p-4 md:p-8 flex items-center justify-center">
        <div className="absolute inset-0 -z-10 h-full w-full items-center px-5 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]" />
        <div className="w-full max-w-4xl mx-auto">
          <Skeleton className="h-48 w-full rounded-lg" />
          <div className="mt-8 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!user || !playerData) {
    return (
      <div className="relative min-h-screen text-white p-4 md:p-8 flex items-center justify-center">
        <div className="absolute inset-0 -z-10 h-full w-full items-center px-5 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]" />
        <div className="text-center">
          <p>No player profile found. Please create one.</p>
          <InteractiveHoverButton
            onClick={() => router.push("/s")}
            className="mt-4"
          >
            Go Back
          </InteractiveHoverButton>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-white p-4 sm:p-6 md:p-8">
      <div className="absolute inset-0 -z-10 h-full w-full items-center px-5 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]" />
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Player Dashboard</h1>
          <InteractiveHoverButton
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            Logout
          </InteractiveHoverButton>
        </header>

        <Card className="bg-white/10 border border-gray-200/20 backdrop-blur-lg rounded-2xl shadow-lg overflow-hidden">
          <div className="md:flex">
            <div className="md:w-1/3 bg-white/5 p-8 flex flex-col items-center justify-center">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-sky-500/50 mb-4">
                <Image
                  src={`https://robohash.org/${playerData.username}`}
                  alt={playerData.username}
                  width={128}
                  height={128}
                />
              </div>
              <CardTitle className="text-3xl font-bold text-center">
                {playerData.username}
              </CardTitle>
              <p className="text-sm text-gray-400 mt-1 text-center">
                {playerData.email}
              </p>
            </div>

            <div className="md:w-2/3 p-8">
              <h2 className="text-2xl font-semibold mb-6">Player Stats</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-lg mb-8">
                <div className="flex items-center gap-3 bg-black/20 p-4 rounded-lg">
                  <Star size={24} className="text-yellow-400" />
                  <div>
                    <p className="text-sm text-gray-400">Score</p>
                    <p className="font-bold text-2xl">{playerData.score}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-black/20 p-4 rounded-lg">
                  <Heart size={24} className="text-red-500" />
                  <div>
                    <p className="text-sm text-gray-400">Lives</p>
                    <p className="font-bold text-2xl">{playerData.life}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-black/20 p-4 rounded-lg">
                  <HelpCircle size={24} className="text-sky-400" />
                  <div>
                    <p className="text-sm text-gray-400">Answered</p>
                    <p className="font-bold text-2xl">
                      {playerData.answered}/{playerData.assignedQuestions}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3 bg-black/20 p-3 rounded-md">
                  <Wallet size={20} className="text-sky-400" />
                  <span className="text-gray-400">Wallet Address:</span>
                  <span className="font-mono">{playerData.walletAddress}</span>
                </div>
              </div>

              <div className="text-center mt-10">
                {playerData.isStaked ? (
                  <InteractiveHoverButton
                    onClick={() => toast.warning("Quiz functionality coming soon!")}
                    className="text-lg px-8 py-3"
                  >
                    Start Quiz
                  </InteractiveHoverButton>
                ) : (
                  <Dialog>
                    <DialogTrigger asChild>
                      <InteractiveHoverButton className="text-lg px-8 py-3">
                        Start Quiz
                      </InteractiveHoverButton>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] bg-white/10 border border-gray-200/20 backdrop-blur-lg rounded-lg shadow-lg text-white">
                      <DialogHeader>
                        <DialogTitle>Stake to Play</DialogTitle>
                        <DialogDescription>
                          You need to stake 1 CELO to start the quiz. This is to
                          ensure commitment and participation.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <InteractiveHoverButton
                          onClick={handleStake}
                          disabled={stakingLoading}
                        >
                          {stakingLoading
                            ? "Staking..."
                            : "Stake 1 CELO and Play"}
                        </InteractiveHoverButton>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PlayerDashboardPage;
