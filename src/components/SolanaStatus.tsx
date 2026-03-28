import { useEffect, useState } from "react";
import { getClusterInfo } from "@/lib/solana";
import { motion } from "framer-motion";

interface ClusterInfo {
  slot: number;
  blockHeight: number;
  epochInfo: { epoch: number; slotIndex: number; slotsInEpoch: number } | null;
  version: { "solana-core": string } | null;
  connected: boolean;
}

const SolanaStatus = () => {
  const [info, setInfo] = useState<ClusterInfo | null>(null);

  useEffect(() => {
    getClusterInfo().then(setInfo);
    const interval = setInterval(() => getClusterInfo().then(setInfo), 15000);
    return () => clearInterval(interval);
  }, []);

  if (!info) {
    return (
      <div className="gradient-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
          <span className="text-sm text-muted-foreground">Connecting to Solana...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="gradient-card border border-border rounded-lg p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${info.connected ? "bg-compliant animate-pulse-glow" : "bg-non-compliant"}`} />
          <span className="text-sm font-medium text-foreground">
            Solana Mainnet {info.connected ? "Connected" : "Disconnected"}
          </span>
        </div>
        {info.version && (
          <span className="text-xs font-mono text-muted-foreground">
            v{info.version["solana-core"]}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Slot</p>
          <p className="text-sm font-mono font-semibold text-foreground">{info.slot.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Block Height</p>
          <p className="text-sm font-mono font-semibold text-foreground">{info.blockHeight.toLocaleString()}</p>
        </div>
        {info.epochInfo && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Epoch</p>
            <p className="text-sm font-mono font-semibold text-foreground">{info.epochInfo.epoch}</p>
          </div>
        )}
      </div>
      {info.epochInfo && (
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Epoch Progress</span>
            <span>{((info.epochInfo.slotIndex / info.epochInfo.slotsInEpoch) * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full gradient-primary rounded-full transition-all"
              style={{ width: `${(info.epochInfo.slotIndex / info.epochInfo.slotsInEpoch) * 100}%` }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default SolanaStatus;
