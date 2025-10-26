import { ethers } from "ethers";

const API_KEY = "7AH9GCCWQWX567NX5PYHP3CHZJ19EZRV7Z";
const RPC_URL = "https://celo-sepolia.drpc.org";

export const getWalletBalance = async (address: string): Promise<string> => {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "accept": "application/json",
    },
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  const balanceInWei = data.result;
  return ethers.formatEther(balanceInWei);
};
