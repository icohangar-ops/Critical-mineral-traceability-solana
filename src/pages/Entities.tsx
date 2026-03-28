import { mockEntities } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { Building2, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

const roleColors: Record<string, string> = {
  miner: "bg-info/15 text-info border-info/30",
  refiner: "bg-pending/15 text-pending border-pending/30",
  converter: "bg-accent/15 text-accent border-accent/30",
  oem: "bg-primary/15 text-primary border-primary/30",
  recycler: "bg-compliant/15 text-compliant border-compliant/30",
  logistics: "bg-muted text-muted-foreground border-border",
  dod_depot: "bg-non-compliant/15 text-non-compliant border-non-compliant/30",
};

const Entities = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Entity Registry</h1>
      <p className="text-sm text-muted-foreground mt-1">Registered supply chain participants and credential status</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {mockEntities.map((ent, i) => (
        <motion.div
          key={ent.id}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className="gradient-card border border-border rounded-lg p-5"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted p-2.5">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{ent.name}</h3>
                <p className="text-[10px] font-mono text-muted-foreground">{ent.id} • {ent.publicKey}</p>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-1 rounded-full border font-medium uppercase ${roleColors[ent.role]}`}>
              {ent.role}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              {ent.isDomestic ? <ShieldCheck className="h-4 w-4 text-compliant" /> : <ShieldAlert className="h-4 w-4 text-pending" />}
              <span className="text-xs text-secondary-foreground">{ent.isDomestic ? "Domestic" : "Foreign"}</span>
            </div>
            <div className="flex items-center gap-2">
              {ent.isAllied ? <ShieldCheck className="h-4 w-4 text-allied" /> : <ShieldX className="h-4 w-4 text-non-compliant" />}
              <span className="text-xs text-secondary-foreground">{ent.isAllied ? "Allied" : "Non-Allied"}</span>
            </div>
            <div className="flex items-center gap-2">
              {ent.isFEOC ? <ShieldX className="h-4 w-4 text-non-compliant" /> : <ShieldCheck className="h-4 w-4 text-compliant" />}
              <span className="text-xs text-secondary-foreground">{ent.isFEOC ? "FEOC" : "Non-FEOC"}</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Jurisdiction</p>
                <p className="text-xs font-mono font-semibold text-foreground">{ent.jurisdiction}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">CMMC Level</p>
                <p className="text-xs font-mono font-semibold text-foreground">L{ent.cmmcLevel}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Last Audit</p>
                <p className="text-xs font-mono font-semibold text-foreground">{ent.facilityAuditDate}</p>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

export default Entities;
