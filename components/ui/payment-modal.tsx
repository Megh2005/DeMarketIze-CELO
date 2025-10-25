
"use client";
import React, { useState } from "react";
import { InteractiveHoverButton } from "./interactive-hover-button";
import { X } from "lucide-react";
import { ethers } from "ethers";
import { ABI } from "@/types/contracts";
import { toast } from "sonner";

interface PaymentModalProps {
  onClose: () => void;
  onPaymentSuccess: () => void;
  amount: number;
}

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;

const PaymentModal: React.FC<PaymentModalProps> = ({
  onClose,
  onPaymentSuccess,
}) => {
  const [isPaying, setIsPaying] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [stakeAmount, setStakeAmount] = useState(0.5);

  const handlePayment = async () => {
    setIsPaying(true);
    const toastId = toast.loading("Processing payment...");
    try {
      if (typeof window.ethereum !== "undefined") {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
        const tx = await contract.stake({
          value: ethers.parseEther(stakeAmount.toString()),
        });
        await tx.wait();
        toast.success("Payment successful!", { id: toastId });
        setIsPaid(true);
        setTimeout(() => {
          onPaymentSuccess();
          onClose();
        }, 2000);
      } else {
        toast.error("Please install MetaMask!", { id: toastId });
      }
    } catch (error) {
      console.error("Payment failed", error);
      toast.error("Payment failed.", { id: toastId });
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-lg">
      <div className="relative w-full max-w-md rounded-lg bg-white/10 border border-gray-200/20 p-8 shadow-lg text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-200 hover:text-gray-400"
        >
          <X size={24} />
        </button>
        {!isPaid ? (
          <>
            <h2 className="mb-4 text-2xl font-bold text-center">
              Complete Your Payment
            </h2>
            <div className="space-y-4 text-center">
              <p>
                To generate questions, you need to stake CELO tokens.
              </p>
              <div className="flex items-center justify-center space-x-4">
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-2xl font-bold">{stakeAmount.toFixed(1)} CELO</p>
              </div>
              <InteractiveHoverButton
                onClick={handlePayment}
                className="w-full"
                disabled={isPaying}
              >
                {isPaying ? "Processing..." : "Pay Now"}
              </InteractiveHoverButton>
            </div>
          </>
        ) : (
          <div className="text-center">
            <h2 className="mb-4 text-2xl font-bold">Payment Successful!</h2>
            <p>Your transaction has been confirmed.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
