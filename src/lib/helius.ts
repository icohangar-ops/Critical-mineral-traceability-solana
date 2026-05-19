const HELIUS_API_KEY = "6a530a18-f0cd-41de-ad60-11608396bc55";
const HELIUS_ENHANCED_BASE = `https://api-mainnet.helius-rpc.com/v0`;

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
  try {
    const response = await fetch(
      `${HELIUS_ENHANCED_BASE}/transactions/?api-key=${HELIUS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: signatures }),
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
  try {
    const params = new URLSearchParams({ "api-key": HELIUS_API_KEY });
    if (options?.before) params.set("before", options.before);
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.type) params.set("type", options.type);

    const response = await fetch(
      `${HELIUS_ENHANCED_BASE}/addresses/${address}/transactions?${params.toString()}`
    );
    if (!response.ok) throw new Error(`Helius API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to get transaction history:", error);
    return [];
  }
};
