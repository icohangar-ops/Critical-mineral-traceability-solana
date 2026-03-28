# CritMinChain — Product Roadmap

This document describes the phased delivery plan for CritMinChain. Each phase represents a cohesive vertical slice of the platform, from policy modeling and UI through on-chain programs, off-chain services, and production hardening for defense and industrial deployment.

Timelines are estimated durations from phase start, not calendar dates. They reflect the scope given a small core team and are subject to revision as the project evolves.

---

## Current Status

| Phase | Title | Status | Estimated Duration |
|-------|-------|--------|--------------------|
| [Phase 0](#phase-0--policy--domain-modeling) | Policy & Domain Modeling | ✅ Complete | 4–6 weeks |
| [Phase 1](#phase-1--frontend-mvp) | Frontend MVP | ✅ Complete | 8–12 weeks |
| [Phase 2](#phase-2--solana-programs) | Solana Programs | 🔄 In Progress | 8–12 weeks |
| [Phase 3](#phase-3--off-chain-services) | Off-Chain Services | 📋 Planned | 8–12 weeks |
| [Phase 4](#phase-4--production-hardening--defense-integration) | Production Hardening & Defense Integration | 📋 Planned | 12+ weeks |

---

## Phase 0 — Policy & Domain Modeling

**Status:** ✅ Complete  
**Duration:** 4–6 weeks

Phase 0 established the canonical data model and policy framework that all subsequent phases build upon. The primary goal was to resolve ambiguity in the domain — reconciling overlapping and sometimes conflicting definitions from DoD procurement directives, IRA statutory text, FEOC regulatory guidance, and industry standards — before writing a single line of application code.

### Deliverables

#### Canonical Asset Types

Defined the set of trackable asset types that span the critical mineral lifecycle:

| Asset Type | Description |
|------------|-------------|
| `RAW_ORE` | Extracted ore at the mine face, prior to any beneficiation |
| `CONCENTRATE` | Beneficiated mineral concentrate (e.g., spodumene concentrate, cobalt hydroxide) |
| `REFINED_MATERIAL` | Refined chemical or metal (e.g., battery-grade lithium carbonate, cobalt sulfate) |
| `PRECURSOR_MATERIAL` | Cathode active material precursor (pCAM) |
| `CATHODE_MATERIAL` | Finished cathode active material (CAM) (e.g., NMC 811, LFP) |
| `CELL` | Manufactured battery cell |
| `MODULE` | Battery module assembled from cells |
| `PACK` | Complete battery pack |

#### Lifecycle Stages

Defined the ordered lifecycle stages that an asset traverses, each corresponding to a distinct set of permissible on-chain events:

`EXTRACTION` → `BENEFICIATION` → `REFINING` → `PRECURSOR_SYNTHESIS` → `CATHODE_PRODUCTION` → `CELL_MANUFACTURING` → `MODULE_ASSEMBLY` → `PACK_ASSEMBLY` → `DELIVERED`

#### Minimal Data Schemas

Defined minimal schemas for the three core domain objects:

- **Asset:** Unique identifier, asset type, lifecycle stage, origin jurisdiction, custodian entity, mass/quantity, batch reference, parent asset references (for provenance linking)
- **Event:** Unique identifier, event type, asset reference(s), actor entity, timestamp, location, input/output quantities, supporting document hash
- **Entity:** Unique identifier, legal name, entity type (miner, refiner, manufacturer, OEM, auditor), jurisdiction, on-chain public key, verification status

#### Policy Profiles

Defined two initial policy profiles that the Compliance Engine will evaluate:

**`US-Domestic-Content-2026-v1`**  
Implements IRA Section 30D "critical mineral requirement" and Section 45X "applicable critical minerals" content thresholds. An asset satisfies this profile if the required percentage (per applicable mineral category) of critical mineral value was extracted or processed in the United States or a qualifying Free Trade Agreement country. The profile encodes the applicable percentage thresholds, the list of qualifying jurisdictions, and the computation methodology for value-fraction attribution across the provenance graph.

**`Defense-Enhanced-Domestic-Content-v1`**  
Implements DoD procurement requirements for battery materials, incorporating FEOC exclusions per 10 U.S.C. § 4871 and Defense Federal Acquisition Regulation Supplement (DFARS) clause requirements. This profile applies stricter jurisdiction whitelists (US + Five Eyes + formal treaty allies), mandates entity-level verification (not just jurisdiction), and requires attestation by a DoD-recognized third-party auditor. Content fractions are computed at both mass and value, and the profile fails if either metric falls below the required threshold.

#### Domain Models in Code

All types, lifecycle stages, and mock data implementing these schemas are codified in `src/lib/mock-data.ts`. This file serves as the single source of truth for domain types shared across the frontend and will be the reference implementation for Rust struct definitions in Phase 2.

---

## Phase 1 — Frontend MVP

**Status:** ✅ Complete  
**Duration:** 8–12 weeks

Phase 1 delivered a production-grade React portal connected to Solana mainnet via Helius RPC. The frontend demonstrates the full intended user experience, enables stakeholder feedback, and provides the interface layer that Solana programs will wire up to in Phase 2.

### Deliverables

#### Solana Mainnet Integration

- Live connection to Solana mainnet via Helius RPC endpoint using `@solana/web3.js`
- Real-time cluster status display: current slot, block height, epoch, and epoch progress
- Connection health monitoring with live status indicator in the navigation sidebar
- Configurable cluster target (`mainnet-beta`, `devnet`, `testnet`) via environment variable

#### Six-Page Portal

| Page | Key Features |
|------|-------------|
| **Command Center** (`/`) | Summary metric cards (assets tracked, compliant batches, entities registered, pending attestations); animated supply chain flow diagram (Mine → Concentrate → Refine → Cathode → Cell → Pack); live Solana cluster info panel |
| **Assets** (`/assets`) | Searchable and filterable asset table; asset type, lifecycle stage, custodian, origin jurisdiction, and compliance status columns; row-level detail expansion |
| **Compliance** (`/compliance`) | Attestation record table; policy profile linkage; Compliant / Non-Compliant / Pending status badges; attestation timestamp and auditor reference |
| **Entities** (`/entities`) | Entity registry table; entity type classification; on-chain public key display; jurisdiction and verification status |
| **Events** (`/events`) | Chronological event timeline; event type icons; asset and actor linkage; quantity and location fields |
| **Verifier** (`/verifier`) | Free-text Solana address input; live Helius Enhanced Transaction API lookup; parsed transaction display; transaction history list |

#### Helius Enhanced API Integration

- `parseTransactions` API integration for human-readable transaction decoding in the Verifier page
- `getTransactionHistory` API integration for paginated transaction history retrieval
- Typed API response handling with error boundary and loading states

#### Design System

- Defense-grade dark aesthetic with high-contrast data displays optimized for operational readiness at a glance
- shadcn/ui component library with custom theme tokens
- Tailwind CSS utility classes with consistent spacing and typography scales
- Responsive layout with collapsible sidebar navigation
- `StatusBadge`, `MetricCard`, `SolanaStatus`, and `SupplyChainFlow` reusable component library

---

## Phase 2 — Solana Programs

**Status:** 🔄 In Progress  
**Duration:** 8–12 weeks

Phase 2 implements the Anchor/Rust on-chain programs that replace the mock data layer with verifiable, tamper-evident on-chain state. This phase is the core of the platform's value proposition — once complete, every asset record and attestation is an on-chain account rather than an in-memory object.

### Deliverables

#### Asset Graph & Provenance Program

The central program for recording and querying the mineral supply chain.

**Accounts (PDAs):**
- `AssetAccount` — stores asset metadata, current lifecycle stage, custodian, and cumulative mass balance
- `ProvenanceEdge` — records a directed parent→child relationship between two asset accounts (e.g., refined material → cathode material), enabling the full provenance DAG to be reconstructed on-chain
- `CustodyRecord` — immutable record of a custody transfer event between two entities

**Instructions:**
- `register_asset` — creates an `AssetAccount` PDA; requires entity registry membership
- `advance_lifecycle_stage` — transitions an asset to the next lifecycle stage; validates stage ordering
- `record_custody_transfer` — creates a `CustodyRecord` and updates the asset's custodian field
- `link_provenance` — creates a `ProvenanceEdge` between a parent and child asset; validates mass conservation constraints
- `close_asset` — marks an asset as delivered/consumed; prevents further modification

**Validation:**
- Signer authority checks on all mutating instructions
- Mass conservation validation on `link_provenance` (output mass ≤ sum of input masses, within configurable tolerance)
- Lifecycle stage ordering enforcement (cannot skip stages)

#### Compliance & Attestation Program

Computes and records compliance status against policy profiles.

**Accounts (PDAs):**
- `PolicyProfile` — stores the serialized policy profile parameters (jurisdiction whitelist, content threshold, computation method)
- `AttestationRecord` — stores the computed content-fraction result, the policy profile used, the attesting entity, the asset reference, and the pass/fail determination
- `AuditLog` — append-only log of attestation computations for a given asset (supports re-attestation as provenance data is added)

**Instructions:**
- `register_policy_profile` — creates a `PolicyProfile` PDA; governance-controlled
- `attest_compliance` — triggers content-fraction computation against a specified policy profile and creates an `AttestationRecord`; callable by authorized auditor entities
- `invalidate_attestation` — marks an existing `AttestationRecord` as superseded; requires the original attesting entity or program governance authority

**Computation:**
- Content fraction is computed as a `u64` in basis points (0–10000) to avoid floating-point precision issues on-chain
- Provenance graph traversal is bounded by a configurable max depth to cap compute unit consumption

#### Entity Registry Program

Manages the set of verified participants in the supply chain.

**Accounts (PDAs):**
- `EntityAccount` — stores legal name, entity type, jurisdiction, on-chain public key, and verification status
- `EntityRole` — maps an entity to a role (miner, refiner, manufacturer, auditor) for a given policy context

**Instructions:**
- `register_entity` — creates an `EntityAccount` PDA; self-registration with pending verification status
- `verify_entity` — promotes an entity to verified status; requires a platform governance authority signature
- `revoke_entity` — marks an entity as revoked; prevents further participation in new events
- `assign_role` — grants a policy-context-specific role to a verified entity

#### PDA-Based Account Model

All accounts use deterministic PDAs derived from application-layer identifiers (e.g., a UUID or external batch identifier) so that accounts are addressable without requiring an on-chain lookup table. Seed schemes are documented in `docs/PROGRAMS.md` (planned).

#### Local Validator Testing Suite

- Full Anchor TypeScript test suite covering all instructions for all three programs
- Test fixtures for both policy profiles
- Happy-path and negative-path test coverage for all instruction validators
- Helper scripts for spinning up a local validator, deploying programs, and seeding test data

---

## Phase 3 — Off-Chain Services

**Status:** 📋 Planned  
**Duration:** 8–12 weeks

Phase 3 builds the off-chain infrastructure that connects real-world data producers (mines, refiners, OEMs) to the Solana programs, and that powers the compliance rules engine and reporting layer.

### Deliverables

#### Verifiable Data Ingestion Service (VDIS)

A TypeScript/Node.js service that acts as the authenticated gateway for external data producers to submit supply chain events.

- REST API endpoints for asset registration, event recording, custody transfer, and provenance linking
- JSON Schema validation for all inbound payloads against canonical schemas
- HMAC-based request authentication for registered data producers
- Transaction construction, fee estimation, and submission to Solana via Helius RPC
- Retry logic with exponential backoff for failed transaction submissions
- Dead-letter queue for payloads that fail validation or submission after max retries

#### Compliance Rules Engine

A standalone service that evaluates provenance data against policy profiles and triggers on-chain attestation.

- Provenance graph construction from on-chain `AssetAccount` and `ProvenanceEdge` accounts
- Content-fraction computation per policy profile (US-Domestic-Content-2026-v1, Defense-Enhanced-Domestic-Content-v1)
- Jurisdiction classification lookup with override registry for jurisdiction edge cases
- Scheduled re-evaluation when upstream provenance data changes
- Generates and submits `attest_compliance` transactions via the Attestation Program

#### Oracle / Data Attestation Service

Bridges third-party data sources (assay laboratories, certification bodies, customs records) into the on-chain provenance record.

- Webhook receiver for external certification events
- Document hash computation (SHA-256) for certificates of analysis and assay reports
- Integration with the IPFS storage layer (Phase 4) for document pinning
- Signs and submits supporting-document-hash attestations as supplemental event data

#### PostgreSQL Persistence Layer

A read-optimized relational database that mirrors on-chain state for low-latency API queries.

- Helius webhook consumer that streams parsed transaction events into the database
- Schema covering: assets, events, entities, attestations, provenance edges, policy profiles
- Indexed for common query patterns: assets by custodian, attestations by policy profile, events by asset
- Database migrations managed with a versioned migration tool (e.g., Flyway or Prisma Migrate)

#### Frontend Integration: Replace Mock Data

Once the VDIS, Compliance Engine, and PostgreSQL layer are operational:

- Replace all `src/lib/mock-data.ts` references with live API calls to the off-chain services
- Implement React Query data fetching with proper cache invalidation
- Connect Verifier page to on-chain attestation records in addition to raw Helius transaction data
- Add real-time event streaming via Helius webhooks for the Events timeline page

---

## Phase 4 — Production Hardening & Defense Integration

**Status:** 📋 Planned  
**Duration:** 12+ weeks

Phase 4 takes the platform from a functional prototype to a hardened, auditable system suitable for DoD and prime contractor pilot integration.

### Deliverables

#### Security Audit and Red-Team Exercises

- External smart contract security audit of all three Solana programs by a recognized Solana security firm
- Penetration testing of off-chain services and API endpoints
- Threat model review covering: oracle manipulation, provenance graph poisoning, entity impersonation, data availability attacks
- Remediation of all critical and high findings before pilot launch
- Publish audit report publicly as part of the project's transparency commitment

#### Multi-Sig Governance for Program Upgrades

- Replace single-key upgrade authority with a multi-signature governance account on all deployed programs
- Define and document the governance process for program upgrades (proposal → timelock → execution)
- Emergency freeze capability for critical vulnerability response
- On-chain changelog for all program deployments linked to GitHub release tags

#### RBAC / Authentication

- Role-Based Access Control for the portal and API layer
- Role definitions: `ADMIN`, `AUDITOR`, `OEM_VIEWER`, `ENTITY_MANAGER`, `GOVERNMENT_AUDITOR`
- Authentication integration compatible with DoD CAC/PIV smart card infrastructure (SAML 2.0 / PKI)
- JWT-based session management for web portal access
- API key management for programmatic access (VDIS data producers)

#### IPFS Metadata Storage

- IPFS pinning service integration (e.g., Web3.Storage or Pinata) for supporting documents
- Content-addressed storage for certificates of analysis, assay reports, and chain-of-custody documents
- IPFS CID stored in on-chain event accounts for tamper-evident document linkage
- Retrieval gateway with access control for sensitive documents

#### DoD / Prime Contractor Pilot Integration

- Pilot program with a DoD program office or Tier 1 defense prime contractor
- Mapping of CritMinChain data model to DFARS clause reporting requirements
- Integration with existing contractor supply chain management systems via VDIS adapter
- Pilot-specific policy profile development (if required beyond existing profiles)
- After-action report and public case study (subject to contractor approval)

#### CMMC Level 2+ Compliance Assessment

- Conduct a CMMC Level 2 readiness assessment against the 110 NIST SP 800-171 practice domains
- Develop a System Security Plan (SSP) and Plan of Action & Milestones (POA&M)
- Implement required technical controls: MFA, audit logging, media protection, incident response
- Engage a Certified Third-Party Assessment Organization (C3PAO) for formal assessment
- Target CMMC Level 2 certification for cloud-hosted components handling CUI

---

## Versioning and Release Policy

CritMinChain follows [Semantic Versioning](https://semver.org/):

- **0.x.y** — Pre-production releases (Phases 0–2). Breaking changes may occur between minor versions.
- **1.0.0** — First production release, targeting completion of Phase 3.
- **1.x.y** — Stable API. Breaking changes require a major version bump.

Solana program versions are tracked separately from the portal and off-chain service versions, as program deployments are governed by the multi-sig upgrade process (Phase 4).

---

## How to Contribute to the Roadmap

Roadmap items are tracked as GitHub Issues with the `roadmap` label. To propose a new roadmap item or to indicate intent to work on a planned item:

1. Open an issue describing the feature, its motivation, and how it fits the platform's mission.
2. Reference any relevant policy or regulatory context.
3. Tag the issue with the appropriate phase label.

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the full contribution process.
