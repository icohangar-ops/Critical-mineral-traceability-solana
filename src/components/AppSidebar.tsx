import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Box,
  ShieldCheck,
  Building2,
  Activity,
  QrCode,
  FileText,
  Settings,
  Database,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/assets", icon: Box, label: "Asset Tracking" },
  { to: "/compliance", icon: ShieldCheck, label: "Compliance" },
  { to: "/entities", icon: Building2, label: "Entity Registry" },
  { to: "/events", icon: Activity, label: "Supply Chain Events" },
  { to: "/verifier", icon: QrCode, label: "Verifier" },
  { to: "/grant-application", icon: FileText, label: "Grant Application" },
];

const AppSidebar = () => {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-sidebar flex flex-col">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <div className="h-8 w-8 rounded-md gradient-primary flex items-center justify-center">
          <Database className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-foreground tracking-wide">CritMinChain</h1>
          <p className="text-[10px] text-muted-foreground font-mono">SOLANA • MAINNET</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all ${
                active
                  ? "bg-primary/10 text-primary font-medium glow-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <Link
          to="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <div className="mt-3 mx-3 px-3 py-2 rounded-md bg-muted/50 border border-border">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-compliant animate-pulse-glow" />
            <span className="text-[10px] font-mono text-muted-foreground">Helius RPC Connected</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
