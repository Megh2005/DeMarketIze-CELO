/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { createContext, useState } from "react";

interface WalletContextType {
  isConnected: boolean;
  setIsConnected: (isConnected: boolean) => void;
  userAddress: string | null;
  setUserAddress: (userAddress: string | null) => void;
  signer: any;
  setSigner: (signer: any) => void;
  balance: string | null;
  setBalance: (balance: string | null) => void;
}

export const WalletContext = createContext<WalletContextType>({
  isConnected: false,
  setIsConnected: () => {},
  userAddress: null,
  setUserAddress: () => {},
  signer: null,
  setSigner: () => {},
  balance: null,
  setBalance: () => {},
});

import { ReactNode } from "react";
import { ethers } from "ethers";

export const WalletContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState();
  const [balance, setBalance] = useState<string | null>(null);

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        setIsConnected,
        userAddress,
        setUserAddress,
        signer,
        setSigner,
        balance,
        setBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
