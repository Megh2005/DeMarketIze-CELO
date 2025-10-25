"use client";
import React, { useState, useContext, useEffect, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { auth, db, googleProvider } from "@/lib/firebase";
import { signInWithPopup, User, signOut } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import WalletButton from "@/components/WalletButton";
import { WalletContext } from "@/context/Wallet";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { FaGoogle } from "react-icons/fa";
import { InteractiveHoverButton } from "./ui/interactive-hover-button";
import { toast } from "sonner";

// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<F>): Promise<ReturnType<F>> =>
        new Promise(resolve => {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => resolve(func(...args)), waitFor);
        });
}

interface PlayerOnboardingProps {
  onClose: () => void;
}

const PlayerOnboarding: React.FC<PlayerOnboardingProps> = ({ onClose }) => {
  const [step, setStep] = useState(1);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const { userAddress } = useContext(WalletContext);

  // Effect for Step 2 -> 3: Wallet connection
  useEffect(() => {
    if (step === 2 && userAddress) {
      const checkWallet = async () => {
          const toastId = toast.loading("Verifying wallet...");
          const companyWalletQuery = query(collection(db, "company"), where("walletAddress", "==", userAddress));
          const companyWalletSnapshot = await getDocs(companyWalletQuery);
          if (!companyWalletSnapshot.empty) {
              toast.error("This wallet address is already registered as a company.", { id: toastId });
              return;
          }

          const playerWalletQuery = query(collection(db, "players"), where("walletAddress", "==", userAddress));
          const playerWalletSnapshot = await getDocs(playerWalletQuery);
          if (!playerWalletSnapshot.empty) {
              toast.error("This wallet address is already registered by another player.", { id: toastId });
              return;
          }

          toast.success("Wallet connected! Please create your profile.", { id: toastId });
          setStep(3);
      };
      checkWallet();
    }
  }, [userAddress, step]);

  const checkUsernameUniqueness = async (username: string) => {
    if (!username) {
        setUsernameError(null);
        return;
    }
    setIsCheckingUsername(true);
    try {
        const companyQuery = query(collection(db, "company"), where("username", "==", username));
        const playerQuery = query(collection(db, "players"), where("username", "==", username));

        const [companySnapshot, playerSnapshot] = await Promise.all([
            getDocs(companyQuery),
            getDocs(playerQuery)
        ]);

        if (!companySnapshot.empty || !playerSnapshot.empty) {
            setUsernameError("Username is already taken.");
        } else {
            setUsernameError(null);
        }
    } catch (error) {
        setUsernameError("Error checking username.");
    }
    setIsCheckingUsername(false);
  };

  const debouncedCheckUsername = useCallback(debounce(checkUsernameUniqueness, 500), []);

  const handleBioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const words = value.split(' ').filter(Boolean);
    if (words.length <= 10) {
      setBio(value);
    }
  };

  useEffect(() => {
    debouncedCheckUsername(username);
  }, [username, debouncedCheckUsername]);

  // Handler for Step 1: Google Sign In
  const handleGoogleSignIn = async () => {
    const toastId = toast.loading("Signing in with Google...");
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const loggedInUser = result.user;

        // The onAuthStateChanged in app/s/page.tsx handles returning users.
        // We only need to check if the email is already a company.
        if (loggedInUser.email) {
            const companyQuery = query(collection(db, "company"), where("email", "==", loggedInUser.email));
            const companySnapshot = await getDocs(companyQuery);
            if (!companySnapshot.empty) {
                toast.error("This email is already registered as a company.", { id: toastId });
                await signOut(auth);
                onClose();
                return;
            }
        }
        
        setUser(loggedInUser);
        toast.success("Signed in successfully! Please connect your wallet.", { id: toastId });
        setStep(2);
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      toast.error("Error during Google sign-in.", { id: toastId });
    }
  };

  // Handler for Step 3: Profile creation
  const handleSubmit = async () => {
    if (!user) {
      toast.error("User not authenticated.");
      return;
    }
    if (!userAddress) {
      toast.error("Wallet not connected.");
      return;
    }
    if (!username || usernameError) {
        toast.error("Please provide a valid username.");
        return;
    }

    const toastId = toast.loading("Creating your player profile...");
    try {
      await setDoc(doc(db, "players", username), {
        authUid: user.uid,
        email: user.email,
        displayName: user.displayName,
        username: username,
        walletAddress: userAddress,
        bio: bio,
        life: 5,
        score: 0,
        answered: 0,
        assignedQuestions: 20,
        createdAt: new Date(),
      });
      toast.success("Player profile created successfully!", { id: toastId });
      router.push('/s/player-dashboard');
    } catch (error) {
      console.error("Error writing document: ", error);
      toast.error("Error creating profile.", { id: toastId });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-lg">
      <div className="relative w-full max-w-lg rounded-lg bg-white/10 border border-gray-200/20 p-8 shadow-lg text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-200 hover:text-gray-400"
        >
          &times;
        </button>
        <div className="mb-4 text-center text-sm font-semibold text-white">
          Player Onboarding - Step {step} of 3
        </div>

        {step === 1 && (
          <div>
            <h2 className="mb-4 text-2xl font-bold text-center">Step 1: Authenticate</h2>
            <p className="mb-6 text-center">
              Sign in with your Google account to get started.
            </p>
            <InteractiveHoverButton onClick={handleGoogleSignIn} className="w-full flex items-center justify-center">
                <div className="flex items-center gap-2">
                    <FaGoogle />
                    <span>Sign in with Google</span>
                </div>
            </InteractiveHoverButton>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="mb-4 text-2xl font-bold text-center">Step 2: Connect Your Wallet</h2>
            <p className="mb-6 text-center">
              Connect your wallet to continue.
            </p>
            <div className="flex justify-center">
                <WalletButton />
            </div>
          </div>
        )}

        {step === 3 && user && (
          <div>
            <h2 className="mb-4 text-2xl font-bold text-center">
              Step 3: Create Your Profile
            </h2>
            <div className="space-y-4">
                <div>
                    <Label className="text-white">Google Account</Label>
                    <Input value={user.email || ""} disabled className="text-white bg-gray-700/50"/>
                </div>
                <div>
                    <Label className="text-white">Wallet Address</Label>
                    <Input value={userAddress || ""} disabled className="text-white bg-gray-700/50"/>
                </div>
                <div>
                    <Label htmlFor="username" className="text-white">Choose a Username</Label>
                    <Input
                      id="username"
                      name="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Choose a unique username"
                      className="text-white bg-gray-800/80"
                      required
                    />
                    {isCheckingUsername && <p className="text-xs text-white mt-1">Checking...</p>}
                    {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
                </div>
                <div>
                    <Label htmlFor="bio" className="text-white">Short Bio (max 10 words)</Label>
                    <Input
                      id="bio"
                      name="bio"
                      value={bio}
                      onChange={handleBioChange}
                      placeholder="Tell us about yourself in 10 words or less..."
                      className="text-white bg-gray-800/80"
                    />
                    <p className="text-xs text-gray-400 mt-1">{bio.split(' ').filter(Boolean).length}/10 words</p>
                </div>
              <InteractiveHoverButton onClick={handleSubmit} className="w-full" disabled={isCheckingUsername || !!usernameError || !username || bio.split(' ').filter(Boolean).length > 10}>
                  Create Profile & Enter
              </InteractiveHoverButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerOnboarding;