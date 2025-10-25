"use client";
import React, { useContext } from "react";
import { WalletContext } from "@/context/Wallet";
import { connectWallet } from "@/utils/connectWallet";
import { InteractiveHoverButton } from "./ui/interactive-hover-button";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const WalletButton = () => {
  const { setIsConnected, setUserAddress, setSigner, isConnected, userAddress } = useContext(WalletContext);

  return (
    <div className="flex justify-center">
      <InteractiveHoverButton
        disabled={isConnected}
        onClick={async () => {
          await connectWallet(setIsConnected, setUserAddress, setSigner);
        }}
        className="w-full"
      >
        {userAddress
          ? `${userAddress.slice(0, 8)}...${userAddress.slice(-8)}`
          : "Connect Wallet"}
      </InteractiveHoverButton>
    </div>
  );
};

export default WalletButton;
