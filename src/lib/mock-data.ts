// Mock data representing on-chain assets and compliance data
// In production, these would be read from Solana PDAs

export type AssetType = "ore_lot" | "concentrate" | "refined_metal" | "precursor" | "cathode" | "cell" | "pack" | "system";
export type ComplianceStatus = "compliant" | "non_compliant" | "pending_review";
export type EntityRole = "miner" | "refiner" | "converter" | "oem" | "recycler" | "logistics" | "dod_depot";

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  entityId: string;
  entityName: string;
  jurisdiction: string;
  createdAt: string;
  metadataHash: string;
  domesticPercentage: number;
  alliedPercentage: number;
  complianceStatus: ComplianceStatus;
  policyId: string;
  parentAssetIds: string[];
  quantity: number;
  unit: string;
  mineral: string;
}

export interface Entity {
  id: string;
  name: string;
  role: EntityRole;
  jurisdiction: string;
  isDomestic: boolean;
  isAllied: boolean;
  isFEOC: boolean;
  facilityAuditDate: string;
  cmmcLevel: number;
  publicKey: string;
}

export interface ComplianceAttestation {
  id: string;
  assetId: string;
  assetName: string;
  policyId: string;
  policyName: string;
  status: ComplianceStatus;
  domesticContent: number;
  alliedContent: number;
  attestedAt: string;
  attestedBy: string;
  merkleRoot: string;
  txSignature: string;
}

export interface SupplyChainEvent {
  id: string;
  type: "extraction" | "transport" | "refine" | "transform" | "assemble" | "certify";
  assetId: string;
  entityId: string;
  entityName: string;
  description: string;
  timestamp: string;
  txSignature: string;
  location: string;
}

export const mockAssets: Asset[] = [
  {
    id: "AST-001", type: "ore_lot", name: "Lithium Ore Lot #2847",
    entityId: "ENT-001", entityName: "Nevada Lithium Corp",
    jurisdiction: "US", createdAt: "2026-01-15T08:00:00Z",
    metadataHash: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    domesticPercentage: 100, alliedPercentage: 100,
    complianceStatus: "compliant", policyId: "POL-001",
    parentAssetIds: [], quantity: 2500, unit: "tonnes", mineral: "Lithium",
  },
  {
    id: "AST-002", type: "concentrate", name: "Li Concentrate Batch C-442",
    entityId: "ENT-002", entityName: "Western Minerals Processing",
    jurisdiction: "US", createdAt: "2026-02-01T10:30:00Z",
    metadataHash: "ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d",
    domesticPercentage: 100, alliedPercentage: 100,
    complianceStatus: "compliant", policyId: "POL-001",
    parentAssetIds: ["AST-001"], quantity: 800, unit: "tonnes", mineral: "Lithium",
  },
  {
    id: "AST-003", type: "refined_metal", name: "Battery-Grade Li₂CO₃ R-119",
    entityId: "ENT-003", entityName: "Allied Refining AU",
    jurisdiction: "AU", createdAt: "2026-02-20T14:00:00Z",
    metadataHash: "a3a5e715f0cc574a73c3f6e1a3494a4c6d913a6093a6093a",
    domesticPercentage: 0, alliedPercentage: 100,
    complianceStatus: "compliant", policyId: "POL-001",
    parentAssetIds: ["AST-002"], quantity: 320, unit: "tonnes", mineral: "Lithium",
  },
  {
    id: "AST-004", type: "cathode", name: "NMC811 Cathode Batch K-77",
    entityId: "ENT-004", entityName: "US Cathode Works",
    jurisdiction: "US", createdAt: "2026-03-05T09:00:00Z",
    metadataHash: "b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c",
    domesticPercentage: 65, alliedPercentage: 100,
    complianceStatus: "compliant", policyId: "POL-001",
    parentAssetIds: ["AST-003"], quantity: 150, unit: "tonnes", mineral: "Lithium",
  },
  {
    id: "AST-005", type: "cell", name: "21700 Cell Lot CL-2201",
    entityId: "ENT-005", entityName: "PowerCell America",
    jurisdiction: "US", createdAt: "2026-03-15T11:00:00Z",
    metadataHash: "c6f057b86584942e415435ffb1fa93d5d1ef1c1b3e13e13e",
    domesticPercentage: 72, alliedPercentage: 100,
    complianceStatus: "compliant", policyId: "POL-002",
    parentAssetIds: ["AST-004"], quantity: 50000, unit: "cells", mineral: "Lithium",
  },
  {
    id: "AST-006", type: "pack", name: "Defense Battery Pack DP-100",
    entityId: "ENT-006", entityName: "DefensePower Systems",
    jurisdiction: "US", createdAt: "2026-03-22T16:00:00Z",
    metadataHash: "d4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35",
    domesticPercentage: 78, alliedPercentage: 100,
    complianceStatus: "compliant", policyId: "POL-002",
    parentAssetIds: ["AST-005"], quantity: 200, unit: "packs", mineral: "Lithium",
  },
  {
    id: "AST-007", type: "ore_lot", name: "Cobalt Ore Lot #891",
    entityId: "ENT-007", entityName: "DRC Mining Co",
    jurisdiction: "CD", createdAt: "2026-01-10T06:00:00Z",
    metadataHash: "e7f6c011776e8db7cd330b54174fd76f7d0216b612387a5ffcfb81e6f0919683",
    domesticPercentage: 0, alliedPercentage: 0,
    complianceStatus: "non_compliant", policyId: "POL-001",
    parentAssetIds: [], quantity: 500, unit: "tonnes", mineral: "Cobalt",
  },
  {
    id: "AST-008", type: "refined_metal", name: "Nickel Sulfate NS-334",
    entityId: "ENT-008", entityName: "Canadian Nickel Ref.",
    jurisdiction: "CA", createdAt: "2026-02-28T12:00:00Z",
    metadataHash: "f0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b",
    domesticPercentage: 0, alliedPercentage: 100,
    complianceStatus: "pending_review", policyId: "POL-001",
    parentAssetIds: [], quantity: 1200, unit: "tonnes", mineral: "Nickel",
  },
];

export const mockEntities: Entity[] = [
  { id: "ENT-001", name: "Nevada Lithium Corp", role: "miner", jurisdiction: "US", isDomestic: true, isAllied: true, isFEOC: false, facilityAuditDate: "2025-11-01", cmmcLevel: 2, publicKey: "NvLi1...x8Qm" },
  { id: "ENT-002", name: "Western Minerals Processing", role: "refiner", jurisdiction: "US", isDomestic: true, isAllied: true, isFEOC: false, facilityAuditDate: "2025-10-15", cmmcLevel: 2, publicKey: "WsMn2...k3Rp" },
  { id: "ENT-003", name: "Allied Refining AU", role: "refiner", jurisdiction: "AU", isDomestic: false, isAllied: true, isFEOC: false, facilityAuditDate: "2025-09-20", cmmcLevel: 1, publicKey: "AlRf3...m7Yz" },
  { id: "ENT-004", name: "US Cathode Works", role: "converter", jurisdiction: "US", isDomestic: true, isAllied: true, isFEOC: false, facilityAuditDate: "2025-12-01", cmmcLevel: 3, publicKey: "UsCt4...n2Wx" },
  { id: "ENT-005", name: "PowerCell America", role: "oem", jurisdiction: "US", isDomestic: true, isAllied: true, isFEOC: false, facilityAuditDate: "2025-08-10", cmmcLevel: 3, publicKey: "PwCl5...j9Vb" },
  { id: "ENT-006", name: "DefensePower Systems", role: "oem", jurisdiction: "US", isDomestic: true, isAllied: true, isFEOC: false, facilityAuditDate: "2026-01-05", cmmcLevel: 3, publicKey: "DfPs6...h4Tc" },
  { id: "ENT-007", name: "DRC Mining Co", role: "miner", jurisdiction: "CD", isDomestic: false, isAllied: false, isFEOC: true, facilityAuditDate: "2024-06-01", cmmcLevel: 0, publicKey: "DrMn7...a1Sd" },
  { id: "ENT-008", name: "Canadian Nickel Ref.", role: "refiner", jurisdiction: "CA", isDomestic: false, isAllied: true, isFEOC: false, facilityAuditDate: "2025-07-22", cmmcLevel: 1, publicKey: "CnNk8...b5Fe" },
];

export const mockAttestations: ComplianceAttestation[] = [
  { id: "ATT-001", assetId: "AST-006", assetName: "Defense Battery Pack DP-100", policyId: "POL-002", policyName: "Defense-Enhanced-Domestic-Content-v1", status: "compliant", domesticContent: 78, alliedContent: 100, attestedAt: "2026-03-23T09:00:00Z", attestedBy: "ENT-006", merkleRoot: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", txSignature: "5KtPn1...xZ9q" },
  { id: "ATT-002", assetId: "AST-005", assetName: "21700 Cell Lot CL-2201", policyId: "POL-002", policyName: "Defense-Enhanced-Domestic-Content-v1", status: "compliant", domesticContent: 72, alliedContent: 100, attestedAt: "2026-03-16T14:30:00Z", attestedBy: "ENT-005", merkleRoot: "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592", txSignature: "3YmQa2...bH7r" },
  { id: "ATT-003", assetId: "AST-007", assetName: "Cobalt Ore Lot #891", policyId: "POL-001", policyName: "US-Domestic-Content-2026-v1", status: "non_compliant", domesticContent: 0, alliedContent: 0, attestedAt: "2026-01-12T10:00:00Z", attestedBy: "ENT-007", merkleRoot: "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b", txSignature: "7RnLk5...cP2m" },
  { id: "ATT-004", assetId: "AST-008", assetName: "Nickel Sulfate NS-334", policyId: "POL-001", policyName: "US-Domestic-Content-2026-v1", status: "pending_review", domesticContent: 0, alliedContent: 100, attestedAt: "2026-03-01T08:00:00Z", attestedBy: "ENT-008", merkleRoot: "d4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35", txSignature: "9TpWx3...dK8n" },
];

export const mockEvents: SupplyChainEvent[] = [
  { id: "EVT-001", type: "extraction", assetId: "AST-001", entityId: "ENT-001", entityName: "Nevada Lithium Corp", description: "Lithium ore extracted from Clayton Valley deposit", timestamp: "2026-01-15T08:00:00Z", txSignature: "2HkMn...xR4q", location: "Clayton Valley, NV" },
  { id: "EVT-002", type: "transport", assetId: "AST-001", entityId: "ENT-001", entityName: "Nevada Lithium Corp", description: "Shipped to Western Minerals Processing", timestamp: "2026-01-20T14:00:00Z", txSignature: "4LpQr...yT6w", location: "Tonopah, NV → Reno, NV" },
  { id: "EVT-003", type: "refine", assetId: "AST-002", entityId: "ENT-002", entityName: "Western Minerals Processing", description: "Concentrated to battery-grade lithium spodumene", timestamp: "2026-02-01T10:30:00Z", txSignature: "6NrSt...zV8e", location: "Reno, NV" },
  { id: "EVT-004", type: "transform", assetId: "AST-003", entityId: "ENT-003", entityName: "Allied Refining AU", description: "Refined to Li₂CO₃ battery-grade material", timestamp: "2026-02-20T14:00:00Z", txSignature: "8PtUv...aX0g", location: "Kwinana, WA, Australia" },
  { id: "EVT-005", type: "transform", assetId: "AST-004", entityId: "ENT-004", entityName: "US Cathode Works", description: "NMC811 cathode active material synthesis", timestamp: "2026-03-05T09:00:00Z", txSignature: "0RvWx...bZ2i", location: "Clarksville, TN" },
  { id: "EVT-006", type: "assemble", assetId: "AST-005", entityId: "ENT-005", entityName: "PowerCell America", description: "21700 cylindrical cell manufacturing", timestamp: "2026-03-15T11:00:00Z", txSignature: "1SxYz...cA4k", location: "Sparks, NV" },
  { id: "EVT-007", type: "assemble", assetId: "AST-006", entityId: "ENT-006", entityName: "DefensePower Systems", description: "Defense battery pack assembly and testing", timestamp: "2026-03-22T16:00:00Z", txSignature: "3TzAb...dC6m", location: "Huntsville, AL" },
  { id: "EVT-008", type: "certify", assetId: "AST-006", entityId: "ENT-006", entityName: "DefensePower Systems", description: "DoD compliance attestation issued", timestamp: "2026-03-23T09:00:00Z", txSignature: "5UbCd...eE8o", location: "Huntsville, AL" },
];

export const supplyChainStats = {
  totalAssets: 847,
  compliantAssets: 612,
  pendingReview: 89,
  nonCompliant: 146,
  registeredEntities: 34,
  activePolicies: 5,
  attestationsThisMonth: 203,
  avgDomesticContent: 71.4,
};
