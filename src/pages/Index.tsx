import { Box, ShieldCheck, Building2, FileCheck, TrendingUp, AlertTriangle } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import SolanaStatus from "@/components/SolanaStatus";
import SupplyChainFlow from "@/components/SupplyChainFlow";
import StatusBadge from "@/components/StatusBadge";
import { supplyChainStats, mockAttestations, mockEvents } from "@/lib/mock-data";
import { motion } from "framer-motion";

const Dashboard = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Command Center</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Critical minerals traceability & domestic content attestation
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <MetricCard title="Total Assets" value={supplyChainStats.totalAssets} icon={Box} trend={{ value: 12, positive: true }} />
      <MetricCard title="Compliant" value={supplyChainStats.compliantAssets} subtitle={`${((supplyChainStats.compliantAssets / supplyChainStats.totalAssets) * 100).toFixed(1)}% compliance rate`} icon={ShieldCheck} variant="success" />
      <MetricCard title="Pending Review" value={supplyChainStats.pendingReview} icon={AlertTriangle} variant="warning" />
      <MetricCard title="Avg Domestic Content" value={`${supplyChainStats.avgDomesticContent}%`} icon={TrendingUp} />
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2">
        <SupplyChainFlow />
      </div>
      <SolanaStatus />
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="gradient-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Recent Attestations</h3>
        <div className="space-y-3">
          {mockAttestations.slice(0, 4).map(a => (
            <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{a.assetName}</p>
                <p className="text-xs text-muted-foreground">{a.policyName}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground">{a.domesticContent}% domestic</span>
                <StatusBadge status={a.status} />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="gradient-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Latest Events</h3>
        <div className="space-y-3">
          {mockEvents.slice(-4).reverse().map(e => (
            <div key={e.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
              <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{e.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{e.entityName}</span>
                  <span className="text-xs font-mono text-muted-foreground">• {e.location}</span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                {new Date(e.timestamp).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard title="Registered Entities" value={supplyChainStats.registeredEntities} icon={Building2} />
      <MetricCard title="Active Policies" value={supplyChainStats.activePolicies} icon={FileCheck} />
      <MetricCard title="Attestations This Month" value={supplyChainStats.attestationsThisMonth} icon={ShieldCheck} trend={{ value: 23, positive: true }} />
    </div>
  </div>
);

export default Dashboard;
