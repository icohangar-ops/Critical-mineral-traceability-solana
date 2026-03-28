import { type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  variant?: "default" | "success" | "warning" | "danger";
}

const variantStyles = {
  default: "border-border",
  success: "border-compliant/30",
  warning: "border-pending/30",
  danger: "border-non-compliant/30",
};

const MetricCard = ({ title, value, subtitle, icon: Icon, trend, variant = "default" }: MetricCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className={`gradient-card rounded-lg border ${variantStyles[variant]} p-5`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
        <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        {trend && (
          <p className={`mt-1 text-xs font-medium ${trend.positive ? "text-compliant" : "text-non-compliant"}`}>
            {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}% this month
          </p>
        )}
      </div>
      <div className="rounded-md bg-muted p-2.5">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
  </motion.div>
);

export default MetricCard;
