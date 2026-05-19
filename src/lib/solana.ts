import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

// Use the standard Helius RPC endpoint (supports browser CORS)
const HELIUS_RPC_URL = "https://mainnet.helius-rpc.com/?api-key=6a530a18-f0cd-41de-ad60-11608396bc55";

export const connection = new Connection(HELIUS_RPC_URL, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 10000,
});

export const getClusterInfo = async () => {
  try {
    const [slot, blockHeight, epochInfo, version] = await Promise.all([
      connection.getSlot(),
      connection.getBlockHeight(),
      connection.getEpochInfo(),
      connection.getVersion(),
    ]);
    return { slot, blockHeight, epochInfo, version, connected: true };
  } catch (error) {
    console.error("Failed to connect to Solana:", error);
    return { slot: 0, blockHeight: 0, epochInfo: null, version: null, connected: false };
  }
};

export const getRecentPerformance = async () => {
  try {
    const perfSamples = await connection.getRecentPerformanceSamples(5);
    return perfSamples;
  } catch {
    return [];
  }
};

export const formatPublicKey = (key: string) => {
  if (key.length <= 12) return key;
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
};

export const lamportsToSol = (lamports: number) => lamports / LAMPORTS_PER_SOL;
