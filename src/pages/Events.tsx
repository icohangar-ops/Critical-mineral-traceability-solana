import { mockEvents } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { Activity, MapPin, ExternalLink } from "lucide-react";

const typeColors: Record<string, string> = {
  extraction: "bg-info", transport: "bg-muted-foreground", refine: "bg-pending",
  transform: "bg-accent", assemble: "bg-primary", certify: "bg-compliant",
};

const Events = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Supply Chain Events</h1>
      <p className="text-sm text-muted-foreground mt-1">Immutable on-chain event log for all asset transformations and transfers</p>
    </div>

    <div className="relative">
      <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-4">
        {mockEvents.map((evt, i) => (
          <motion.div
            key={evt.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="relative pl-14"
          >
            <div className={`absolute left-[18px] top-5 h-3 w-3 rounded-full ${typeColors[evt.type] || "bg-muted"} ring-4 ring-background`} />
            <div className="gradient-card border border-border rounded-lg p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium uppercase">{evt.type}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{evt.id}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{evt.description}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground">{evt.entityName}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />{evt.location}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{new Date(evt.timestamp).toLocaleString()}</p>
                  <a href="#" className="flex items-center gap-1 text-[10px] font-mono text-primary hover:underline mt-1 justify-end">
                    {evt.txSignature} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

export default Events;
