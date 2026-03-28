import { useState } from "react";
import { motion } from "framer-motion";
import { Send, FileText, ExternalLink, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const fundingCategories = [
  { value: "ai", label: "AI" },
  { value: "consumer", label: "Consumer" },
  { value: "defi", label: "DeFi" },
  { value: "depin", label: "DePIN" },
  { value: "dev-education", label: "Developer Education & Ecosystem" },
  { value: "dev-tooling", label: "Developer Tooling" },
];

const GrantApplication = () => {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    websiteUrl: "",
    country: "",
    firstName: "",
    lastName: "",
    email: "",
    onChainAccounts: "",
    fundingCategory: "",
    whyYou: "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const allFilled = Object.values(form).every((v) => v.trim() !== "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allFilled) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitted(true);
    toast.success("Application submitted successfully!");
  };

  if (submitted) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Grant Application</h1>
          <p className="text-sm text-muted-foreground mt-1">Solana Foundation Funding Application</p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="gradient-card border border-border rounded-lg p-12 text-center max-w-2xl mx-auto"
        >
          <CheckCircle className="h-16 w-16 text-compliant mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Application Submitted</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Your Solana Foundation funding application for <span className="text-foreground font-medium">{form.companyName}</span> has been recorded.
          </p>
          <div className="gradient-card border border-border rounded-lg p-4 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Company</span>
              <span className="text-foreground font-mono">{form.companyName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Category</span>
              <span className="text-foreground font-mono">
                {fundingCategories.find((c) => c.value === form.fundingCategory)?.label}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">On-Chain Accounts</span>
              <span className="text-foreground font-mono truncate max-w-[200px]">{form.onChainAccounts || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Applicant</span>
              <span className="text-foreground font-mono">{form.firstName} {form.lastName}</span>
            </div>
          </div>
          <button
            onClick={() => { setSubmitted(false); setForm({ companyName: "", websiteUrl: "", country: "", firstName: "", lastName: "", email: "", onChainAccounts: "", fundingCategory: "", whyYou: "" }); }}
            className="mt-6 px-6 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            Submit Another Application
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Grant Application</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solana Foundation Funding Application — public goods for the Solana ecosystem
          </p>
        </div>
        <a
          href="https://share.hsforms.com/1GE1hYdApQGaDiCgaiWMXHA5lohw"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-primary hover:underline shrink-0"
        >
          Original Form <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="gradient-card border border-border rounded-lg p-6 max-w-3xl">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Application Details
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          The goal of the Solana Foundation Grants Program is to fund public goods for the Solana ecosystem.
          Please refer to the{" "}
          <a href="https://tinyurl.com/y2abys36" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            application guidance
          </a>{" "}
          for details.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Row 1: Company, Website, Country */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Company Name <span className="text-destructive">*</span></label>
              <Input value={form.companyName} onChange={(e) => update("companyName", e.target.value)} placeholder="CritMinChain Inc." className="bg-muted border-border font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Website URL <span className="text-destructive">*</span></label>
              <Input value={form.websiteUrl} onChange={(e) => update("websiteUrl", e.target.value)} placeholder="https://critminchain.io" className="bg-muted border-border font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Country <span className="text-destructive">*</span></label>
              <Input value={form.country} onChange={(e) => update("country", e.target.value)} placeholder="United States" className="bg-muted border-border font-mono text-sm" />
            </div>
          </div>

          {/* Row 2: First, Last, Email */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">First Name <span className="text-destructive">*</span></label>
              <Input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} placeholder="John" className="bg-muted border-border text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Last Name <span className="text-destructive">*</span></label>
              <Input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} placeholder="Doe" className="bg-muted border-border text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Email Address <span className="text-destructive">*</span></label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="john@company.com" className="bg-muted border-border text-sm" />
            </div>
          </div>

          {/* On-Chain Accounts */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Solana On-Chain Accounts <span className="text-destructive">*</span></label>
            <p className="text-[10px] text-muted-foreground">
              Insert this project's on-chain addresses (program ID, token address, fee payer wallets etc.). Separate them using a comma. Write "N/A" if not applicable.
            </p>
            <Textarea
              value={form.onChainAccounts}
              onChange={(e) => update("onChainAccounts", e.target.value)}
              placeholder="e.g. CritM1n...x8Qm, TokenA...k3Rp or N/A"
              className="bg-muted border-border font-mono text-sm min-h-[80px]"
            />
          </div>

          {/* Funding Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Funding Category <span className="text-destructive">*</span></label>
            <Select value={form.fundingCategory} onValueChange={(v) => update("fundingCategory", v)}>
              <SelectTrigger className="bg-muted border-border text-sm">
                <SelectValue placeholder="Please Select" />
              </SelectTrigger>
              <SelectContent>
                {fundingCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Why You */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Why You? <span className="text-destructive">*</span></label>
            <p className="text-[10px] text-muted-foreground">
              Why are you and your team the best people to build this project? What edge do you have over the competition?
            </p>
            <Textarea
              value={form.whyYou}
              onChange={(e) => update("whyYou", e.target.value)}
              placeholder="Describe your team's unique qualifications..."
              className="bg-muted border-border text-sm min-h-[120px]"
            />
          </div>

          {/* Disclaimer & Submit */}
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground mb-4">
              By clicking "Submit", you confirm that you are permitted to act on behalf of the project described above,
              and that you are submitting this application of your own volition and initiative.
            </p>
            <button
              type="submit"
              disabled={!allFilled}
              className="px-8 py-3 rounded-lg gradient-primary text-primary-foreground font-medium text-sm disabled:opacity-50 transition-opacity flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Submit Application
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GrantApplication;
