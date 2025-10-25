"use client";

import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import CompanyOnboarding from "@/components/company-onboarding";
import PlayerOnboarding from "@/components/player-onboarding";
import { Skeleton } from "@/components/ui/skeleton";

const Hero: React.FC = () => {
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const companyQuery = query(collection(db, "company"), where("authUid", "==", user.uid));
        const companySnapshot = await getDocs(companyQuery);
        if (!companySnapshot.empty) {
          router.push("/s/dashboard");
          return;
        }

        const playerQuery = query(collection(db, "players"), where("authUid", "==", user.uid));
        const playerSnapshot = await getDocs(playerQuery);
        if (!playerSnapshot.empty) {
          router.push("/s/player-dashboard");
          return;
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="relative h-screen flex items-center justify-center">
        <div className="absolute inset-0 -z-10 h-full w-full items-center px-5 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]" />
        <Skeleton className="h-20 w-1/2" />
      </div>
    );
  }

  return (
    <div className="relative h-screen">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 -z-10 h-full w-full items-center px-5 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4">
        <div className="max-w-3xl text-center">
          <h1 className="mb-8 text-4xl font-bold sm:text-6xl lg:text-7xl text-white">
            Identify <span className="text-sky-400">Yourself </span>As
          </h1>
          <div className="flex flex-wrap text-xl justify-center gap-4">
            <InteractiveHoverButton
              className="border-2 border-white"
              onClick={() => setIsCompanyModalOpen(true)}
            >
              Company
            </InteractiveHoverButton>
            <InteractiveHoverButton 
              className="border-2 border-white"
              onClick={() => setIsPlayerModalOpen(true)}
            >
              Player
            </InteractiveHoverButton>
          </div>
        </div>
      </div>

      {isCompanyModalOpen && <CompanyOnboarding onClose={() => setIsCompanyModalOpen(false)} />}
      {isPlayerModalOpen && <PlayerOnboarding onClose={() => setIsPlayerModalOpen(false)} />}
    </div>
  );
};

export default Hero;
