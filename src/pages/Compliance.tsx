import { mockAttestations } from "@/lib/mock-data";
import StatusBadge from "@/components/StatusBadge";
import { motion } from "framer-motion";
import { ShieldCheck, ExternalLink } from "lucide-react";

const Compliance = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Compliance & Attestations</h1>
      <p className="text-sm text-muted-foreground mt-1">Policy attestation records with on-chain verification</p>
    </div>

    <div className="grid gap-4">
      {mockAttestations.map((att, i) => (
        <motion.div
          key={att.id}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className="gradient-card border border-border rounded-lg p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-md bg-primary/10 p-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{att.assetName}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{att.policyName}</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-1">Attestation {att.id}</p>
              </div>
            </div>
            <StatusBadge status={att.status} />
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Domestic Content</p>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-compliant rounded-full" style={{ width: `${att.domesticContent}%` }} />
                </div>
                <span className="text-sm font-mono font-semibold text-foreground">{att.domesticContent}%</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Allied Content</p>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-allied rounded-full" style={{ width: `${att.alliedContent}%` }} />
                </div>
                <span className="text-sm font-mono font-semibold text-foreground">{att.alliedContent}%</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Attested</p>
              <p className="text-sm text-foreground mt-1">{new Date(att.attestedAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tx Signature</p>
              <a href="#" className="flex items-center gap-1 text-sm font-mono text-primary hover:underline mt-1">
                {att.txSignature} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[10px] text-muted-foreground">
              <span className="uppercase tracking-wider">Merkle Root:</span>{" "}
              <span className="font-mono">{att.merkleRoot.slice(0, 32)}...</span>
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

export default Compliance;
