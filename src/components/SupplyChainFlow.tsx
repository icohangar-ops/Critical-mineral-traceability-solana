import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const stages = [
  { label: "Mine", color: "bg-info", count: 3 },
  { label: "Concentrate", color: "bg-allied", count: 2 },
  { label: "Refine", color: "bg-pending", count: 4 },
  { label: "Cathode", color: "bg-accent", count: 2 },
  { label: "Cell", color: "bg-primary", count: 5 },
  { label: "Pack", color: "bg-compliant", count: 3 },
];

const SupplyChainFlow = () => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.2 }}
    className="gradient-card border border-border rounded-lg p-5"
  >
    <h3 className="text-sm font-semibold text-foreground mb-4">Supply Chain Pipeline</h3>
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {stages.map((stage, i) => (
        <div key={stage.label} className="flex items-center gap-2">
          <div className="flex flex-col items-center min-w-[72px]">
            <div className={`h-10 w-10 rounded-lg ${stage.color}/20 flex items-center justify-center border border-current/20`}>
              <span className={`text-sm font-bold ${stage.color.replace("bg-", "text-")}`}>{stage.count}</span>
            </div>
            <span className="mt-1.5 text-[10px] text-muted-foreground font-medium">{stage.label}</span>
          </div>
          {i < stages.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        </div>
      ))}
    </div>
  </motion.div>
);

export default SupplyChainFlow;
