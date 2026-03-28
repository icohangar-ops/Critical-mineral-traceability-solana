import { useState } from "react";
import { motion } from "framer-motion";
import { Search, ShieldCheck, ShieldX, ExternalLink, Loader2 } from "lucide-react";
import { getTransactionHistory, type EnhancedTransaction } from "@/lib/helius";
import { formatPublicKey } from "@/lib/solana";

const Verifier = () => {
  const [address, setAddress] = useState("");
  const [txHistory, setTxHistory] = useState<EnhancedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setSearched(true);
    const history = await getTransactionHistory(address.trim(), { limit: 10 });
    setTxHistory(history);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Verifier</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Look up Solana addresses and verify on-chain transaction history via Helius Enhanced APIs
        </p>
      </div>

      <div className="gradient-card border border-border rounded-lg p-6">
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          Solana Address Lookup
        </label>
        <div className="flex gap-3 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Enter Solana address (e.g. Vote111...)"
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !address.trim()}
            className="px-6 py-3 rounded-lg gradient-primary text-primary-foreground font-medium text-sm disabled:opacity-50 transition-opacity flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Verify
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Querying Helius Enhanced API...</span>
        </div>
      )}

      {!loading && searched && txHistory.length === 0 && (
        <div className="gradient-card border border-border rounded-lg p-8 text-center">
          <ShieldX className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No transactions found for this address</p>
        </div>
      )}

      {!loading && txHistory.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Transaction History ({txHistory.length} results)
          </h3>
          {txHistory.map((tx, i) => (
            <motion.div
              key={tx.signature}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="gradient-card border border-border rounded-lg p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium uppercase">
                      {tx.type || "UNKNOWN"}
                    </span>
                    {tx.source && (
                      <span className="text-[10px] text-muted-foreground">via {tx.source}</span>
                    )}
                  </div>
                  <p className="text-xs text-foreground">{tx.description || "No description available"}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-muted-foreground">Fee Payer:</span>
                    <span className="text-[10px] font-mono text-secondary-foreground">
                      {formatPublicKey(tx.feePayer)}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : "—"}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    Fee: {(tx.fee / 1e9).toFixed(6)} SOL
                  </p>
                  <a
                    href={`https://solscan.io/tx/${tx.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:underline mt-1"
                  >
                    {formatPublicKey(tx.signature)} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {tx.nativeTransfers && tx.nativeTransfers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Native Transfers</p>
                  {tx.nativeTransfers.slice(0, 3).map((t, j) => (
                    <div key={j} className="flex items-center gap-2 text-[10px] font-mono text-secondary-foreground">
                      <span>{formatPublicKey(t.fromUserAccount)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span>{formatPublicKey(t.toUserAccount)}</span>
                      <span className="text-primary font-semibold ml-auto">{(t.amount / 1e9).toFixed(4)} SOL</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Verifier;
