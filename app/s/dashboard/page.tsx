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
} from "firebase/firestore";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  Globe,
  Hash,
  Mail,
  User as UserIcon,
  Wallet,
  LogOut,
  ArrowRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ethers } from "ethers";
import { ABI } from "@/types/contracts";

const DashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [companyData, setCompanyData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [questionsExist, setQuestionsExist] = useState(false);
  const router = useRouter();
  const [stakeAmount, setStakeAmount] = useState("");
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [stakingLoading, setStakingLoading] = useState<boolean>(false);
  const [totalStaked, setTotalStaked] = useState<string | null>(null);

  useEffect(() => {
    if (contract) {
      const fetchTotalStaked = async () => {
        try {
          const totalStaked = await contract.totalStaked();
          setTotalStaked(ethers.formatEther(totalStaked));
        } catch (error) {
          console.error("Error fetching total staked:", error);
        }
      };
      fetchTotalStaked();
    }
  }, [contract, stakingLoading]);

  useEffect(() => {
    const initializeProvider = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const web3Provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await web3Provider.send("eth_accounts", []);
          if (accounts.length > 0) {
            const signerInstance = await web3Provider.getSigner();
            const contractInstance = new ethers.Contract(
              process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const q = query(
            collection(db, "company"),
            where("authUid", "==", currentUser.uid)
          );
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const companyData = querySnapshot.docs[0].data();
            setCompanyData(companyData);
            if (companyData.questionsGenerated) {
              setQuestionsExist(true);
            }
          } else {
            setCompanyData(null);
          }
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setCompanyData(null);
        setLoading(false);
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [router]);

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

  const handleGenerateQuestions = async () => {
    if (!user) return;

    setGenerating(true);
    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: user.uid }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setQuestionsExist(true);
      } else {
        throw new Error(data.error || "Failed to generate questions");
      }
    } catch (error) {
      console.error("Error generating questions:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate questions"
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleShowQuestions = () => {
    router.push("/s/questions");
  };

  const handleStake = async () => {
    if (!contract) {
      toast.error("Please connect your wallet first.");
      return;
    }
    if (!stakeAmount || isNaN(parseFloat(stakeAmount))) {
      toast.error("Please enter a valid amount.");
      return;
    }

    const toastId = toast.loading("Staking CELO...");
    try {
      setStakingLoading(true);
      const tx = await contract.stake({
        value: ethers.parseEther(stakeAmount),
      });
      await tx.wait();
      toast.success("Staking successful!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Staking failed.", { id: toastId });
    } finally {
      setStakingLoading(false);
    }
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

  if (!user || !companyData) {
    return (
      <div className="relative min-h-screen text-white p-4 md:p-8 flex items-center justify-center">
        <div className="absolute inset-0 -z-10 h-full w-full items-center px-5 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]" />
        <div className="text-center">
          <p>No company profile found. Please create one.</p>
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
          <h1 className="text-3xl font-bold">Company Dashboard</h1>
          <InteractiveHoverButton onClick={handleLogout} className="flex items-center gap-2">
            Logout
          </InteractiveHoverButton>
        </header>

        <Card className="bg-white/10 border border-gray-200/20 backdrop-blur-lg rounded-2xl shadow-lg overflow-hidden">
          <div className="md:flex">
            <div className="md:w-1/3 bg-white/5 p-8 flex flex-col items-center justify-center">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-sky-500/50 mb-4">
                <Image
                  src={`https://robohash.org/${companyData.companyName}`}
                  alt={companyData.companyName}
                  width={128}
                  height={128}
                />
              </div>
              <CardTitle className="text-3xl font-bold text-center">
                {companyData.companyName}
              </CardTitle>
              <a
                href={companyData.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline mt-1 text-center"
              >
                {companyData.website}
              </a>
            </div>

            <div className="md:w-2/3 p-8">
              <h2 className="text-2xl font-semibold mb-6">Company Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-lg">
                <div className="flex items-center gap-3">
                  <UserIcon size={20} className="text-sky-400" />
                  <p>
                    <strong>Username:</strong> {companyData.username}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={20} className="text-sky-400" />
                  <p>
                    <strong>Email:</strong> {companyData.email}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Globe size={20} className="text-sky-400" />
                  <p>
                    <strong>Country:</strong> {companyData.country}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Hash size={20} className="text-sky-400" />
                  <p>
                    <strong>Questions Required:</strong>
                    <Badge className="ml-2">{companyData.numberOfQuestions}</Badge>
                  </p>
                </div>
                <div className="flex items-center gap-3 col-span-full">
                  <Wallet size={20} className="text-sky-400" />
                  <p className="font-mono text-sm">
                    <strong>Wallet:</strong> {companyData.walletAddress}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Wallet size={20} className="text-green-400" />
                  <p>
                    <strong>Total Pool:</strong> {totalStaked ? parseFloat(totalStaked).toFixed(1) : '0.0'} CELO
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Briefcase size={20} />
                  Company Description
                </h3>
                <p className="text-gray-300 bg-black/20 p-4 rounded-md">
                  {companyData.companyDescription}
                </p>
              </div>

              <div className="text-center mt-10 flex justify-center gap-4">
                {questionsExist ? (
                  <InteractiveHoverButton onClick={handleShowQuestions} className="text-lg px-8 py-3">
                    Show Questions
                  </InteractiveHoverButton>
                ) : (
                  <InteractiveHoverButton
                    onClick={handleGenerateQuestions}
                    disabled={generating}
                    className="text-lg px-8 py-3"
                  >
                    {generating
                      ? "Generating Questions..."
                      : "Generate Questions"}
                  </InteractiveHoverButton>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <InteractiveHoverButton className="text-lg px-8 py-3">
                      Add Pool
                    </InteractiveHoverButton>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] bg-white/10 border border-gray-200/20 backdrop-blur-lg rounded-lg shadow-lg text-white">
                    <DialogHeader>
                      <DialogTitle>Add to Pool</DialogTitle>
                      <DialogDescription>
                        Enter the amount of CELO you want to stake.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <Input
                        id="amount"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        placeholder="Amount in CELO"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <DialogFooter>
                      <Button onClick={handleStake} disabled={stakingLoading}>
                        {stakingLoading ? "Staking..." : "Stake"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;