import { useState } from "react";
import { mockAssets, type AssetType } from "@/lib/mock-data";
import StatusBadge from "@/components/StatusBadge";
import { motion } from "framer-motion";
import { Search, Filter, Box } from "lucide-react";

const typeLabels: Record<AssetType, string> = {
  ore_lot: "Ore Lot", concentrate: "Concentrate", refined_metal: "Refined Metal",
  precursor: "Precursor", cathode: "Cathode", cell: "Cell", pack: "Pack", system: "System",
};

const Assets = () => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");

  const filtered = mockAssets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || a.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Asset Tracking</h1>
        <p className="text-sm text-muted-foreground mt-1">Track critical minerals from mine to battery system</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Search assets by name or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <select
            className="pl-10 pr-8 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as AssetType | "all")}
          >
            <option value="all">All Types</option>
            {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="gradient-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Asset", "Type", "Entity", "Jurisdiction", "Domestic %", "Allied %", "Status", "Quantity"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((asset, i) => (
                <motion.tr
                  key={asset.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Box className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{asset.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{asset.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-secondary-foreground">{typeLabels[asset.type]}</td>
                  <td className="px-4 py-3 text-xs text-secondary-foreground">{asset.entityName}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-secondary-foreground">{asset.jurisdiction}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-compliant rounded-full" style={{ width: `${asset.domesticPercentage}%` }} />
                      </div>
                      <span className="text-xs font-mono text-secondary-foreground">{asset.domesticPercentage}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-allied rounded-full" style={{ width: `${asset.alliedPercentage}%` }} />
                      </div>
                      <span className="text-xs font-mono text-secondary-foreground">{asset.alliedPercentage}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={asset.complianceStatus} /></td>
                  <td className="px-4 py-3 text-xs font-mono text-secondary-foreground">{asset.quantity.toLocaleString()} {asset.unit}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Assets;
