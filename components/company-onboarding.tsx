"use client";
import React, { useState, useContext, useEffect, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { auth, db, googleProvider } from "@/lib/firebase";
import { onAuthStateChanged, signInWithPopup, User, signOut } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { countries } from "@/lib/countries";
import WalletButton from "@/components/WalletButton";
import { WalletContext } from "@/context/Wallet";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { FaGoogle } from "react-icons/fa";
import { InteractiveHoverButton } from "./ui/interactive-hover-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import { ethers } from "ethers";
import { ABI } from "@/types/contracts";

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


interface CompanyOnboardingProps {
  onClose: () => void;
}

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;

const CompanyOnboarding: React.FC<CompanyOnboardingProps> = ({ onClose }) => {
  const [step, setStep] = useState(1);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    username: "",
    companyName: "",
    website: "",
    companyEmail: "",
    country: "",
    companyDescription: "",
    numberOfQuestions: "",
    walletAddress: "",
    websiteConsent: false,
    privacyConsent: false,
    transactionId: "",
  });

  const generateTransactionId = (length: number) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const { userAddress } = useContext(WalletContext);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setFormData(prev => ({
          ...prev,
          name: currentUser.displayName || "",
          email: currentUser.email || "",
        }));
        setStep(2); // Skip to step 2 if already logged in
      } else {
        setUser(null);
        setStep(1);
      }
    });
    return () => unsubscribe();
  }, []);

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

  useEffect(() => {
    debouncedCheckUsername(formData.username);
  }, [formData.username, debouncedCheckUsername]);


  const handleGoogleSignIn = async () => {
    const toastId = toast.loading("Signing in with Google...");
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const loggedInUser = result.user;

        if (loggedInUser.email) {
            const playersQuery = query(collection(db, "players"), where("email", "==", loggedInUser.email));
            const playersSnapshot = await getDocs(playersQuery);
            if (!playersSnapshot.empty) {
                toast.error("This email is already registered as a player.", { id: toastId });
                await signOut(auth);
                onClose();
                return;
            }
        }

        setUser(loggedInUser);
        setFormData({
            ...formData,
            name: loggedInUser.displayName || "",
            email: loggedInUser.email || "",
        });
        toast.success("Signed in successfully!", { id: toastId });
        setStep(2);
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      toast.error("Error during Google sign-in.", { id: toastId });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const { checked } = e.target as HTMLInputElement;
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleNextStep = () => {
    if (step === 2) {
        if (!formData.username || !formData.companyName || !formData.website || !formData.companyEmail || !formData.country || !formData.companyDescription || !formData.numberOfQuestions) {
            toast.error("Please fill all fields.");
            return;
        }
        if (usernameError) {
            toast.error(usernameError);
            return;
        }
    }
    const toastId = toast.loading("Proceeding to next step...");
    setTimeout(() => {
        toast.dismiss(toastId);
        setStep(step + 1);
    }, 1000);
  };

  const handlePayment = async () => {
    const toastId = toast.loading("Processing payment...");
    try {
      if (typeof window.ethereum !== "undefined") {
        const stakeAmount = Number(formData.numberOfQuestions) * 0.001;
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
        const tx = await contract.stake({
          value: ethers.parseEther(stakeAmount.toString()),
        });
        await tx.wait();
        const transactionId = tx.hash;
        setFormData({ ...formData, transactionId });
        toast.success("Payment successful!", { id: toastId });
        setStep(step + 1);
      } else {
        toast.error("Please install MetaMask!", { id: toastId });
      }
    } catch (error) {
      console.error("Payment failed", error);
      toast.error("Payment failed.", { id: toastId });
    }
  };

  const handlePreviousStep = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("User not authenticated.");
      return;
    }
    if (!userAddress) {
      toast.error("Wallet not connected.");
      return;
    }
    if (!formData.websiteConsent || !formData.privacyConsent) {
      toast.error("Please provide consent.");
      return;
    }

    const toastId = toast.loading("Creating company profile...");
    try {
        const playersWalletQuery = query(collection(db, "players"), where("walletAddress", "==", userAddress));
        const playersWalletSnapshot = await getDocs(playersWalletQuery);
        if (!playersWalletSnapshot.empty) {
            toast.error("This wallet address is already registered as a player.", { id: toastId });
            return;
        }

        await setDoc(doc(db, "company", formData.username), {
        ...formData,
        authUid: user.uid,
        walletAddress: userAddress,
        createdAt: new Date(),
        transactionDone: formData.transactionId ? true : false,
        });
        toast.success("Company profile created successfully!", { id: toastId });
        router.push('/s/dashboard');
    } catch (error) {
        console.error("Error writing document: ", error);
        toast.error("Error creating profile.", { id: toastId });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-lg">
      <div className="relative w-full max-w-3xl rounded-lg bg-white/10 border border-gray-200/20 p-8 shadow-lg text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-200 hover:text-gray-400"
        >
          &times;
        </button>
        <div className="mb-4 text-center text-sm font-semibold text-white">
          Step {step} of 4
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

        {step === 2 && user && (
          <div>
            <h2 className="mb-4 text-2xl font-bold text-center">
              Step 2: Company Information
            </h2>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label className="text-white">Name</Label>
                        <Input value={formData.name} disabled className="text-white"/>
                    </div>
                    <div>
                        <Label className="text-white">Email</Label>
                        <Input value={formData.email} disabled className="text-white"/>
                    </div>
                    <div>
                        <Label htmlFor="username" className="text-white">Username</Label>
                        <Input
                          id="username"
                          name="username"
                          value={formData.username}
                          onChange={handleChange}
                          placeholder="Choose a unique username"
                          className="text-white"
                          required
                        />
                        {isCheckingUsername && <p className="text-xs text-white mt-1">Checking...</p>}
                        {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
                    </div>
                    <div>
                        <Label htmlFor="companyName" className="text-white">Company Name</Label>
                        <Input
                          id="companyName"
                          name="companyName"
                          value={formData.companyName}
                          onChange={handleChange}
                          placeholder="Your company's name"
                          className="text-white"
                          required
                        />
                    </div>
                    <div>
                        <Label htmlFor="website" className="text-white">Official Website</Label>
                        <Input
                          id="website"
                          name="website"
                          value={formData.website}
                          onChange={handleChange}
                          placeholder="https://example.com"
                          className="text-white"
                          required
                        />
                    </div>
                    <div>
                        <Label htmlFor="companyEmail" className="text-white">Company Email</Label>
                        <Input
                          id="companyEmail"
                          name="companyEmail"
                          type="email"
                          value={formData.companyEmail}
                          onChange={handleChange}
                          placeholder="contact@example.com"
                          className="text-white"
                          autoComplete="off"
                          required
                        />
                    </div>
                    <div>
                        <Label className="text-white">Country</Label>
                        <Select onValueChange={(value) => handleSelectChange("country", value)} value={formData.country}>
                            <SelectTrigger className="w-full text-white">
                                <SelectValue placeholder="Select a country" />
                            </SelectTrigger>
                            <SelectContent>
                                {countries.map((country) => (
                                <SelectItem key={country.code} value={country.name}>
                                    {country.name}
                                </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label className="text-white">Number of Questions</Label>
                        <Select onValueChange={(value) => handleSelectChange("numberOfQuestions", value)} value={formData.numberOfQuestions}>
                            <SelectTrigger className="w-full text-white">
                                <SelectValue placeholder="Select number of questions" />
                            </SelectTrigger>
                            <SelectContent>
                                {[10, 20, 30, 40, 50].map((num) => (
                                <SelectItem key={num} value={String(num)}>
                                    {num}
                                </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div>
                    <Label htmlFor="companyDescription" className="text-white">Company Description</Label>
                    <Textarea
                        id="companyDescription"
                        name="companyDescription"
                        value={formData.companyDescription}
                        onChange={handleChange}
                        placeholder="Tell us about your company (max 100 words)"
                        maxLength={600}
                        className="text-white"
                        required
                    />
                    <p className="text-xs text-white mt-1 text-right">{formData.companyDescription.length}/600</p>
                </div>
              <div className="flex gap-4">
                <InteractiveHoverButton onClick={handlePreviousStep} className="w-full">
                    Previous
                </InteractiveHoverButton>
                <InteractiveHoverButton onClick={handleNextStep} className="w-full" disabled={isCheckingUsername || !!usernameError}>
                  Next
                </InteractiveHoverButton>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="mb-4 text-2xl font-bold text-center">Step 3: Payment</h2>
            <div className="space-y-4 text-center">
              <p>Based on your selection of {formData.numberOfQuestions} questions, the estimated cost is:</p>
              <p className="text-4xl font-bold">{Number(formData.numberOfQuestions) * 0.1} CELO</p>
              <InteractiveHoverButton onClick={handlePayment} className="w-full">
                Pay Now
              </InteractiveHoverButton>
            </div>
            <div className="flex gap-4 mt-4">
                <InteractiveHoverButton onClick={handlePreviousStep} className="w-full">
                    Previous
                </InteractiveHoverButton>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="mb-4 text-2xl font-bold text-center">
              Step 4: Connect & Consent
            </h2>
            <div className="space-y-4">
              <div>
                <Label className="text-white">Wallet Address</Label>
                <WalletButton />
                {userAddress && (
                  <Input
                    value={userAddress}
                    disabled
                    className="mt-2 text-white"
                  />
                )}
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="websiteConsent"
                  name="websiteConsent"
                  checked={formData.websiteConsent}
                  onChange={handleChange}
                  required
                />
                <Label htmlFor="websiteConsent">
                  I consent to accessing my website.
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="privacyConsent"
                  name="privacyConsent"
                  checked={formData.privacyConsent}
                  onChange={handleChange}
                  required
                />
                <Label htmlFor="privacyConsent">
                  I agree to the privacy regulations.
                </Label>
              </div>
              <div className="flex gap-4">
                <InteractiveHoverButton onClick={handlePreviousStep} className="w-full">
                    Previous
                </InteractiveHoverButton>
                <InteractiveHoverButton
                    onClick={handleSubmit}
                    className="w-full"
                    disabled={!userAddress}
                >
                    Submit
                </InteractiveHoverButton>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyOnboarding;