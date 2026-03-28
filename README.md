# CritMinChain

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Solana](https://img.shields.io/badge/Solana-mainnet-9945FF?logo=solana&logoColor=white)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Status: Alpha](https://img.shields.io/badge/Status-Alpha-orange)](https://github.com/zan-maker/helius-pulse-forge)

**Solana-based Critical Minerals Traceability Platform — mine to cell pack, tamper-evident, DoD/IRA-compliant.**

---

## Overview

CritMinChain is an open-source traceability platform that records every custody transfer, processing step, and compliance attestation for critical minerals — from extraction at the mine face through concentration, refining, cathode production, cell manufacturing, and final pack assembly — as tamper-evident, on-chain events on the Solana blockchain. By anchoring provenance records to immutable ledger state and computing "US-origin / allied-origin content" fractions against codified policy profiles, CritMinChain gives DoD procurement officers, IRA tax-credit auditors, OEM sustainability teams, and independent verifiers a single, cryptographically verifiable source of truth for mineral supply chains.

---

## Why CritMinChain?

- **Critical mineral traceability is broken.** The dominant record-keeping system for lithium, cobalt, nickel, manganese, and rare earth elements today is a patchwork of spreadsheets, PDF certificates, and unverifiable supplier declarations. There is no tamper-evident audit trail and no common data model across the supply chain.
- **DoD needs verifiable domestic content.** Defense procurement directives and the National Defense Authorization Act increasingly require proof that battery and electronics materials do not originate from Foreign Entities of Concern (FEOCs). Self-attested paperwork does not meet that bar.
- **IRA Sections 45X and 30D require mineral provenance.** The Inflation Reduction Act ties manufacturing tax credits and EV credits directly to the percentage of critical minerals extracted or processed in the US or in qualifying Free-Trade-Agreement countries. Without a cryptographically verifiable chain of custody, claiming these credits carries significant legal and audit risk.
- **Current systems cannot be composed or automated.** PDF-based certificates of analysis cannot be queried, aggregated, or fed into automated compliance engines. Every audit is a manual, months-long reconciliation exercise. CritMinChain replaces that with on-chain events that are queryable, composable, and attestable in real time.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Data Producers                                │
│          Mines · Refiners · Cathode OEMs · Cell Manufacturers        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  signed structured data
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│               Verifiable Data Ingestion Service (VDIS)               │
│        Validates, normalizes, hashes, and submits transactions       │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  Anchor instructions
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        Solana Programs (Anchor/Rust)                 │
│  ┌──────────────────┐  ┌───────────────────────┐  ┌───────────────┐ │
│  │  Asset Graph &   │  │  Compliance &         │  │    Entity     │ │
│  │  Provenance      │  │  Attestation Program  │  │    Registry   │ │
│  │  Program         │  │                       │  │    Program    │ │
│  └──────────────────┘  └───────────────────────┘  └───────────────┘ │
└──────────────┬──────────────────────────────┬────────────────────────┘
               │  on-chain state reads        │  attestation queries
               ▼                              ▼
┌─────────────────────────┐    ┌──────────────────────────────────────┐
│   Compliance Rules      │    │         Helius Enhanced APIs         │
│   Engine (off-chain)    │    │    Parse Tx · Tx History · Webhooks  │
└────────────┬────────────┘    └──────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          Consumer Portals                            │
│   OEM Portal  ·  Auditor / Government Portal  ·  Verifier Widget    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## What's Live

The React/TypeScript frontend is deployed and connected to Solana mainnet via Helius RPC. The following portal pages and integrations are fully functional against mock domain data while Solana programs are under development:

| Page | Route | Description |
|------|-------|-------------|
| **Command Center** | `/` | Real-time dashboard: live Solana slot/epoch, summary metrics, supply chain flow visualization |
| **Assets** | `/assets` | Searchable, filterable asset tracking table with lifecycle stage and compliance status |
| **Compliance** | `/compliance` | Attestation records with policy profile linkage and status badges |
| **Entities** | `/entities` | Registry of mines, refiners, and manufacturers with on-chain identifiers |
| **Events** | `/events` | Chronological timeline of supply chain custody and processing events |
| **Verifier** | `/verifier` | Live Solana address lookup using Helius Enhanced Transaction API |

**Helius Integration:**
- Live RPC status indicator (cluster, slot, block height, epoch) via `@solana/web3.js`
- Enhanced transaction parsing via Helius `parseTransactions` API
- Transaction history retrieval via Helius `getTransactionHistory` API

---

## What's Planned

The following components are designed and roadmapped but not yet implemented. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full phased delivery plan.

**Solana Programs (Anchor/Rust):**
- Asset Graph & Provenance Program — PDA-based asset accounts, custody transfer instructions, provenance DAG
- Compliance & Attestation Program — policy profile validation, on-chain attestation records, content-fraction computation
- Entity Registry Program — verified entity onboarding, role assignment, stake-based reputation

**Off-Chain Services:**
- Verifiable Data Ingestion Service (VDIS) — ingests structured data from mines/OEMs, validates schemas, submits transactions
- Compliance Rules Engine — applies FEOC/IRA/DoD policy profiles against provenance graphs
- Oracle / Data Attestation Service — bridges third-party assay and certification data on-chain

**Persistence & Infrastructure:**
- PostgreSQL read model for historical queries and reporting
- IPFS metadata storage for supporting documents (certificates of analysis, assay reports)
- Redis-based event queue for ingestion pipeline

**Security & Access Control:**
- Role-Based Access Control (RBAC) with DoD CAC/PIV compatibility
- Multi-sig governance for Solana program upgrades
- CMMC Level 2+ compliance posture

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | [Solana](https://solana.com) (mainnet / devnet) |
| RPC & Enhanced APIs | [Helius](https://helius.dev) |
| Smart Contracts | [Anchor](https://anchor-lang.com) / Rust *(planned)* |
| Frontend Framework | [React 18](https://react.dev) + [TypeScript 5](https://www.typescriptlang.org/) |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Build Tool | [Vite](https://vitejs.dev/) |
| Web3 | [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/) |

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+ or pnpm 8+
- A [Helius](https://helius.dev) API key (free tier is sufficient for development)

### Installation

```bash
git clone https://github.com/zan-maker/helius-pulse-forge.git
cd helius-pulse-forge
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
# Required — Helius API key for RPC and Enhanced API calls
VITE_HELIUS_API_KEY=your_helius_api_key_here

# Optional — override the default Solana cluster (mainnet-beta | devnet | testnet)
VITE_SOLANA_CLUSTER=mainnet-beta
```

> **Note:** Never commit your `.env` file. It is listed in `.gitignore` by default.

### Run the Development Server

```bash
npm run dev
```

The portal will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phased delivery plan with milestones and current status |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) *(planned)* | Detailed system architecture and component design |
| [`docs/PROGRAMS.md`](docs/PROGRAMS.md) *(planned)* | Solana program specifications and instruction reference |
| [`docs/POLICY_PROFILES.md`](docs/POLICY_PROFILES.md) *(planned)* | FEOC, IRA, and DoD policy profile definitions |
| [`docs/DATA_SCHEMAS.md`](docs/DATA_SCHEMAS.md) *(planned)* | Canonical asset, event, and entity data schemas |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contribution guidelines, development setup, and PR process |

---

## License

This project is licensed under the **Apache License, Version 2.0**. See the [`LICENSE`](LICENSE) file for the full text.

---

## Contact

**Sam D** · [sam@cubiczan.com](mailto:sam@cubiczan.com)

For security disclosures, please email directly rather than opening a public issue.
