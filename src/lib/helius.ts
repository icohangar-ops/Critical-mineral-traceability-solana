import { safeFetch } from "./resilience/safeFetch";

const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY || "";

// Route Helius Enhanced API calls through a relative path. In dev, vite.config.ts
// proxies "/helius" to api-mainnet.helius-rpc.com and injects the API key
// server-side, so the key never appears in the browser-visible URL, CDN, or
// server access logs. In prod, point this same path at a serverless/edge
// function that injects the key. The query-string key has been removed from the
// client; we only fall back to it when no proxy is configured (legacy/local).
const HELIUS_ENHANCED_BASE = "/helius/v0";

// Per-attempt timeout and retry budget for the interactive user path.
const HELIUS_TIMEOUT_MS = 8_000;
const HELIUS_MAX_ATTEMPTS = 3;

export interface EnhancedTransaction {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  description: string;
  nativeTransfers?: { fromUserAccount: string; toUserAccount: string; amount: number }[];
  tokenTransfers?: { fromUserAccount: string; toUserAccount: string; tokenAmount: number; mint: string }[];
  accountData?: { account: string; nativeBalanceChange: number }[];
}

export const parseTransactions = async (signatures: string[]): Promise<EnhancedTransaction[]> => {
  if (!HELIUS_API_KEY) {
    console.warn("Helius API key not configured — transaction parsing disabled");
    return [];
  }
  try {
    const response = await safeFetch(
      new URL(`${HELIUS_ENHANCED_BASE}/transactions/`, window.location.origin),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: signatures }),
        timeoutMs: HELIUS_TIMEOUT_MS,
        maxAttempts: HELIUS_MAX_ATTEMPTS,
      }
    );
    if (!response.ok) throw new Error(`Helius API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to parse transactions:", error);
    return [];
  }
};

export const getTransactionHistory = async (
  address: string,
  options?: { before?: string; limit?: number; type?: string }
): Promise<EnhancedTransaction[]> => {
  if (!HELIUS_API_KEY) {
    console.warn("Helius API key not configured — transaction history disabled");
    return [];
  }
  try {
    const url = new URL(
      `${HELIUS_ENHANCED_BASE}/addresses/${address}/transactions`,
      window.location.origin
    );
    if (options?.before) url.searchParams.set("before", options.before);
    if (options?.limit) url.searchParams.set("limit", options.limit.toString());
    if (options?.type) url.searchParams.set("type", options.type);

    const response = await safeFetch(url, {
      timeoutMs: HELIUS_TIMEOUT_MS,
      maxAttempts: HELIUS_MAX_ATTEMPTS,
    });
    if (!response.ok) throw new Error(`Helius API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to get transaction history:", error);
    return [];
  }
};
