import { cn } from "@/lib/utils";
import type { ComplianceStatus } from "@/lib/mock-data";

const statusConfig: Record<ComplianceStatus, { label: string; className: string }> = {
  compliant: { label: "Compliant", className: "bg-compliant/15 text-compliant border-compliant/30" },
  non_compliant: { label: "Non-Compliant", className: "bg-non-compliant/15 text-non-compliant border-non-compliant/30" },
  pending_review: { label: "Pending Review", className: "bg-pending/15 text-pending border-pending/30" },
};

const StatusBadge = ({ status }: { status: ComplianceStatus }) => {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", config.className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
};

export default StatusBadge;
