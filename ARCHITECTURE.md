# CritMinChain — System Architecture

> **Status:** Living document · Last updated: 2026-03-28  
> **Audience:** Engineers, system integrators, compliance architects

---

## System Overview

CritMinChain is a Solana-native traceability platform that tracks critical minerals — lithium, cobalt, nickel, manganese, graphite, and rare earth elements — from extraction through battery pack assembly, creating an immutable provenance chain that satisfies US Department of Defense (DoD) and Inflation Reduction Act (IRA) origin-content requirements. Each physical custody or transformation event is written to Solana as a tamper-evident on-chain record, keyed by a program-derived address (PDA) tied to an off-chain UUID. An off-chain Compliance Rules Engine traverses the upstream asset graph, aggregates value and mass by jurisdiction, and posts succinct attestation records with Merkle roots back on-chain so that any verifier — OEM procurement system, DoD auditor, or IRS/Treasury reviewer — can confirm compliance status without trusting a centralized party.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT INTERFACES                         │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ OEM      │  │ Auditor      │  │ Verifier Widget       │ │
│  │ Portal   │  │ Portal       │  │ (QR / Browser)        │ │
│  └────┬─────┘  └──────┬───────┘  └───────────┬───────────┘ │
└───────┼────────────────┼──────────────────────┼─────────────┘
        │                │                      │
        │   React/TS + Helius RPC (read/write)  │
        │                │                      │
┌───────┼────────────────┼──────────────────────┼─────────────┐
│       ▼                ▼                      ▼             │
│              OFF-CHAIN SERVICES                              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │ VDIS     │  │ Compliance   │  │ Oracle/Attestation │    │
│  │ Ingestion│  │ Rules Engine │  │ Service            │    │
│  └────┬─────┘  └──────┬───────┘  └────────┬───────────┘    │
└───────┼────────────────┼───────────────────┼────────────────┘
        │                │                   │
        │   Signed transactions via RPC      │
        │                │                   │
┌───────┼────────────────┼───────────────────┼────────────────┐
│       ▼                ▼                   ▼                │
│                 SOLANA ON-CHAIN LAYER                        │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │ Asset Graph  │  │ Compliance &   │  │ Entity         │  │
│  │ & Provenance │  │ Attestation    │  │ Registry       │  │
│  │ Program      │  │ Program        │  │ Program        │  │
│  └──────────────┘  └────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## On-Chain Layer (Solana)

The on-chain layer consists of three Anchor-based Solana programs. All mutable state lives in PDAs; no upgradeable logic is used after the governance-controlled freeze window. Programs communicate through CPI calls gated by role checks in the Entity Registry.

### 1. Asset Graph & Provenance Program

This program owns the canonical ledger of physical assets and their relationships. Every discrete lot of mineral material — from a freshly-blasted ore lot to a finished battery pack — is represented as an `AssetAccount` PDA keyed by `[b"asset", asset_type, off_chain_uuid]`. The UUID is issued by the originating entity's Verifiable Data Ingestion Service (VDIS) and is never reused.

**Responsibilities:**

- **Asset creation** — Mints a new `AssetAccount` for each lot, recording mass (in milligrams as `u64` for precision), value (USD cents as `u64`), jurisdiction (ISO 3166-1 alpha-2), and a SHA-256 hash pointer to off-chain metadata stored in IPFS. Raw commercial data (invoice amounts, counterparty names, GPS coordinates) is never written on-chain; only the hash.
- **Transformation recording** — When a refiner smelts three ore lots into one refined metal lot, the program writes a `TransformationEvent` that lists input asset IDs, output asset IDs, and the transformation type. This creates directed graph edges in the provenance DAG. The program enforces conservation rules: the sum of input masses must equal the sum of output masses within a configurable yield-loss tolerance (e.g., ±5% for smelting). Violations are rejected at the program level.
- **Transfer recording** — Records custody transfers between entities, updating `owner_entity` on the `AssetAccount` and emitting a transfer event. The outgoing entity must sign; the program verifies against the registered authority in the Entity Registry via CPI.
- **Immutability guarantees** — Once an asset is marked `Consumed` or `Retired`, no further mutations are accepted. This prevents double-spend of upstream lots across multiple downstream transformation paths.

**Graph structure:** The asset graph is a directed acyclic graph (DAG) where nodes are `AssetAccount` PDAs and edges are encoded as `parent_assets: Vec<[u8; 32]>` fields within each downstream asset. Traversal is performed off-chain by the Compliance Rules Engine via Helius Enhanced APIs (getProgramAccounts with filters).

### 2. Compliance & Attestation Program

This program stores the policy configuration and compliance results that constitute legally relevant attestations for DoD DFARS 252.225 and IRA Section 30D/45X purposes.

**Responsibilities:**

- **PolicyProfile management** — Stores `PolicyProfile` accounts that encode the qualifying jurisdiction list, FEOC entity Merkle root, minimum domestic-content thresholds (in basis points, separately for value and mass), effective/expiry dates, and the governance authority allowed to publish updates. Multiple concurrent policy versions can coexist, enabling transition periods.
- **Attestation storage** — Receives compliance results from the off-chain Compliance Rules Engine (signed by the oracle authority registered in the Entity Registry) and stores them as `AttestationRecord` PDAs keyed by `[b"attestation", asset_id, policy_id]`. Each record stores the computed domestic/allied percentages, a `ComplianceStatus` enum, and a Merkle root over all upstream asset IDs and their jurisdictional metadata that were used in the calculation. This allows anyone to independently verify the computation by replaying the graph traversal.
- **Separation of computation** — Heavy graph traversal and percentage calculations are intentionally performed off-chain. The Compliance Rules Engine does the work, then posts a succinct, signed result. The on-chain program validates the oracle's signature, checks that the referenced asset and policy IDs exist, and writes the result. This pattern keeps transaction costs low while preserving verifiability through the Merkle commitment.
- **Expiry enforcement** — Attestation records are keyed to a `PolicyProfile`'s effective/expiry window. Queries for expired policy versions are surfaced as `Expired` status, prompting re-attestation under the current policy.

### 3. Entity Registry & Access Control Program

This program is the identity and permission layer for the entire system. Every participant — mine, refiner, converter, OEM, recycler, DoD depot, or auditor — must be registered here before they can write to any other program.

**Responsibilities:**

- **Entity registration** — Creates `EntityAccount` PDAs storing the entity type, signing authority (a Solana Pubkey), jurisdiction, and boolean flags for domestic, allied, and FEOC status. The FEOC flag is set/cleared by the Oracle Service when it publishes updated entity lists. An entity cannot self-set these flags.
- **Credential binding** — Attaches structured `Credential` records to an entity: facility audit certifications, export-control clearances, CMMC maturity level (0–3), ISO 13485/9001 certifications, and chain-of-custody standard identifiers (e.g., RMI RMAP, LME passporting). Credentials include an expiry timestamp and a hash of the supporting document.
- **Role management** — Assigns roles from the canonical set: `ROLE_MINER`, `ROLE_REFINER`, `ROLE_OEM`, `ROLE_DOD_VERIFIER`, `ROLE_AUDITOR`, `ROLE_ORACLE`, `ROLE_ADMIN`. Roles gate which instructions an entity may invoke across all three programs. Role assignments are themselves gated behind `ROLE_ADMIN` or governance multisig.
- **Selective disclosure** — Entities may designate certain credential fields as restricted-visibility. The metadata hash is always on-chain; the actual document is in IPFS behind access control managed by the VDIS. This supports cases where a mine's GPS coordinates or a refiner's customer list is commercially sensitive.
- **CPI access control** — The Asset Graph and Compliance programs call into the Entity Registry via CPI to verify that the transaction signer holds the required role for any given instruction. This centralizes authorization logic and avoids duplication across programs.

---

## Off-Chain Services

Off-chain services are stateless or event-driven microservices that interface with enterprise systems, perform heavy computation, and submit signed transactions to Solana. They are operated by authorized platform participants or by CritMinChain's hosted infrastructure under a trust agreement.

### VDIS — Verifiable Data Ingestion Service

The VDIS is the primary integration surface between enterprise data systems and the Solana programs.

**Functions:**
- Connects to ERP (SAP S/4HANA, Oracle ERP Cloud), MES, WMS, and LIMS systems via REST, GraphQL, and EDI (X12 856/857 ASNs) adapters. Batch and streaming ingestion modes are supported.
- Validates incoming event payloads against JSON Schema definitions: required fields, unit consistency, jurisdiction code validity, mass conservation pre-checks.
- Strips commercially sensitive fields (exact GPS, counterparty names, unit prices) before hashing. Generates SHA-256 metadata hash and stores the full payload in IPFS (or a permissioned object store for classified supply chains).
- Generates or receives off-chain UUIDs, derives the target PDA address, builds the Anchor instruction, signs with an HSM-backed key, and submits to Solana via Helius RPC. Uses durable nonces for reliable submission in high-latency environments.
- Emits a signed ingestion receipt back to the originating enterprise system for their records.

**Deployment model:** Runs as a containerized service in the entity's own infrastructure (mine operator, refiner) or as a CritMinChain-hosted SaaS adapter. HSM integration uses AWS CloudHSM or on-prem PKCS#11 devices.

### Compliance Rules Engine

The Rules Engine encodes the legal and regulatory logic for each `PolicyProfile` and produces attestations on demand or on a scheduled basis.

**Functions:**
- Accepts a trigger (new asset creation, custody transfer, or explicit re-attest request) and the target asset ID and policy ID.
- Fetches the full upstream asset graph by traversing `parent_assets` links, starting from the target asset and walking back to leaf (mine-origin) nodes. Uses Helius `getProgramAccounts` with `memcmp` filters and batched `getMultipleAccounts` for efficiency.
- For each upstream leaf asset, resolves the owning entity's jurisdiction and FEOC status from the Entity Registry. Checks the entity against the FEOC Merkle list in the `PolicyProfile`.
- Aggregates mass (in milligrams) and value (in USD cents) by jurisdiction across all upstream nodes. Computes domestic %, allied %, and FEOC-tainted % using the apportionment methodology specified in the policy (value-basis or mass-basis).
- Computes a Merkle tree over the set of upstream (asset_id, jurisdiction, mass, value) tuples. Generates the Merkle root and stores the full tree off-chain for verification.
- Signs the result with the oracle authority key and submits an `attest` instruction to the Compliance & Attestation Program.
- Exposes a REST API for on-demand attestation requests from the OEM Portal and Auditor Portal.

### Oracle / Data Attestation Service

The Oracle Service maintains authoritative external reference data that the on-chain programs rely on for correctness of jurisdiction and entity classifications.

**Functions:**
- Ingests and maintains: US Treasury/OFAC FEOC-linked entity lists, DoD qualifying country lists (DFARS 225.872-1), IRS/Treasury qualifying jurisdiction lists for IRA purposes, sanctioned entity lists (OFAC SDN), and LME/SHFE commodity price feeds for value apportionment.
- Publishes signed state roots of these lists to the `PolicyProfile` accounts on a configurable schedule (e.g., daily for FEOC lists, on regulatory update for jurisdiction lists). The Merkle root stored in `PolicyProfile.feoc_entities` is the root of the published list.
- Provides signed price attestations for commodity valuations used by the Compliance Rules Engine when invoice-level pricing is unavailable (fallback to market rate).
- Maintains an audit log of all published state roots with timestamps for regulatory inspection.

---

## Client Interfaces

All client interfaces are read-heavy and interact with Solana primarily through Helius RPC and Enhanced APIs. Write operations (dispute submissions, credential uploads) are signed in-browser with connected wallets (Phantom, Backpack) or via delegated VDIS signing for automated workflows.

### OEM Portal

The OEM Portal is the primary operational dashboard for battery manufacturers and prime contractors.

- **Batch ingestion dashboard** — Displays ingestion queue status, VDIS pipeline health, and per-asset event confirmation status with Solana explorer links.
- **Real-time compliance view** — Shows current attestation status for all active pack assemblies and cell batches, with domestic/allied/FEOC percentages color-coded against policy thresholds. Supports filtering by vehicle program, supply chain tier, or policy version.
- **Dispute workflows** — Allows OEMs to flag disputed events (e.g., incorrect mass recorded by upstream supplier). Disputes are tracked as off-chain records linked to the on-chain event ID; resolution requires a counter-signed correction from the original entity.
- **Export** — Generates machine-readable compliance packages (JSON-LD, CSV) for submission to DoD contracting officers or IRS Form 8936 documentation.

### Auditor Portal

The Auditor Portal is designed for DoD contracting officers, IRS auditors, third-party attestors, and internal compliance teams.

- **Policy-centric view** — Allows selection of a specific `PolicyProfile` version and displays all assets attested under it, with aggregate pass/fail statistics.
- **Drill-down provenance viewer** — Renders the full upstream asset DAG for any selected asset as an interactive graph, showing each node's jurisdiction, mass, value, and entity. Drill-down stops at leaf nodes (mine-origin lots).
- **Cryptographic proof panel** — For any attestation, displays the Merkle root, allows the auditor to submit a specific upstream asset ID and receive the inclusion proof, and verifies it client-side against the on-chain root.
- **Machine-readable exports** — Exports NIST 800-172 compliant attestation packages, PDF-rendered supply chain reports, and W3C Verifiable Credential formatted proofs.

### Verifier Widget

A lightweight, embeddable verification tool for spot-checking compliance status without portal login.

- Accepts a QR-code-encoded `AssetID` (PDA address or off-chain UUID) via camera scan or manual entry.
- Queries Helius for the current `AttestationRecord` and `AssetAccount`, displays compliance status, domestic/allied/FEOC percentages, and policy version.
- Validates the on-chain attestation signature client-side.
- Designed for field use: DoD receiving inspectors, customs officials, import brokers.

---

## Data Flow

The following describes the end-to-end lifecycle of a mineral lot through the system:

```
1. EXTRACTION
   Mine operator's ERP records a new ore lot extraction event.
   VDIS at the mine site validates the payload, strips sensitive fields,
   hashes metadata → uploads to IPFS → derives AssetAccount PDA →
   submits signed `create_asset` instruction to Asset Graph Program.
   AssetAccount created on-chain: asset_type=OreLot, jurisdiction=US,
   mass_kg=50000, metadata_hash=<sha256>.

2. CUSTODY TRANSFER
   Mine transfers lot to concentrator.
   VDIS records TransferEvent on-chain, updates owner_entity.
   Entity Registry CPI confirms mine has ROLE_MINER and concentrator
   is a registered entity.

3. TRANSFORMATION (CONCENTRATION)
   Concentrator processes ore lot → concentrate lot.
   VDIS submits `record_transformation`:
     input_assets = [ore_lot_pda], output_assets = [concentrate_lot_pda]
     transformation_type = Concentrate
   Program checks mass conservation (ore_mass * yield_factor ≈ concentrate_mass).
   Ore lot status → Consumed. Concentrate lot → Active.

4. DOWNSTREAM TRANSFORMATIONS
   Concentrate → refined metal (Smelt) → precursor (Convert) →
   cathode (CathodeManufacture) → cell (CellAssembly) →
   pack (PackAssembly).
   Each step writes a TransformationEvent; prior assets are Consumed.

5. COMPLIANCE ATTESTATION
   OEM requests attestation for PackAssembly asset.
   Compliance Rules Engine traverses full upstream DAG (potentially
   dozens of nodes across multiple supply tiers).
   Resolves each leaf entity's jurisdiction and FEOC status via
   Entity Registry. Checks against PolicyProfile qualifying lists.
   Aggregates mass and value by jurisdiction. Computes domestic %.
   Builds Merkle tree over upstream inputs. Signs result.
   Submits `write_attestation` to Compliance & Attestation Program.
   AttestationRecord PDA created on-chain.

6. VERIFICATION
   DoD auditor opens Auditor Portal, selects pack asset,
   views AttestationRecord: domestic_pct_value=6200 (62%),
   compliance_status=Compliant.
   Auditor runs Merkle inclusion proof on a specific upstream lot.
   Proof verifies against on-chain merkle_root.
   Auditor exports W3C Verifiable Credential package.
```

---

## Integration Points

### ERP / MES / WMS Systems

| System | Integration Method | Event Types |
|---|---|---|
| SAP S/4HANA | REST API (OData v4), batch EDI X12 856 | GR posting, GI posting, production order confirmation |
| Oracle ERP Cloud | REST (FSCM APIs), GraphQL | Transfer orders, inventory adjustments |
| Siemens Opcenter | MES REST API | Production lot creation, yield recording |
| Generic WMS | EDI X12 ASN (856/857), REST | Inbound/outbound shipment events |

The VDIS normalizes all inbound payloads to a canonical `CritMinEvent` JSON schema before validation and on-chain submission.

### Recycling / Circularity

Recycled feedstock is treated as a new upstream node of type `RecycledFeedstock`. The Entity performing the recycling operation submits a `RecycleIn` transformation event that consumes the end-of-life asset (if tracked) or creates a new feedstock node with provenance metadata (recycled content percentage, source battery system IDs where known). This allows circularity to be traced and factored into domestic-content calculations under applicable IRA guidance.

### Defense Systems

- Contract metadata (CAGE code, contract number, CLIN) can be attached as restricted credential fields on the OEM's `EntityAccount` and referenced in attestation exports.
- Export-control gates: assets associated with ITAR/EAR-controlled materials can be flagged in the `EntityAccount` credential set. The VDIS checks these flags before allowing transfer events to non-cleared entities.
- DoD DIBBS and PIEE integration for direct contract compliance reporting is planned via machine-readable attestation package export.

### Helius RPC Integration

The platform uses [Helius](https://www.helius.dev/) as its primary Solana RPC provider:

- **Standard RPC** — Transaction submission (`sendTransaction` with `maxRetries`), account fetching (`getAccountInfo`, `getMultipleAccounts`), and block confirmation (`confirmTransaction` with `finalized` commitment).
- **Enhanced Transaction APIs** — Parsed transaction history for event audit trails, webhook subscriptions for real-time account change notifications to the portal backend.
- **`getProgramAccounts`** — Used by the Compliance Rules Engine to enumerate all `AssetAccount` PDAs owned by the Asset Graph Program, filtered by `asset_type` and `owner_entity` memcmp filters for efficient graph traversal.
- **Priority fees** — The VDIS estimates priority fees via Helius fee estimates and includes compute budget instructions to ensure reliable landing during network congestion.

---

## Performance Targets

| Metric | Target | Notes |
|---|---|---|
| Single event write cost | < $0.01 USD | Solana base fee + priority fee; bulk ingestion amortized |
| Transaction finality | < 1 second | Solana optimistic confirmation; `finalized` ~2.5s |
| End-to-end portal display | < 3 seconds | From asset ID to full attestation view including graph fetch |
| Compliance attestation compute | < 30 seconds | For graph depth ≤ 8 tiers, ≤ 200 upstream nodes |
| Asset scale | Millions of assets | Full lifecycle on-chain; archival via account closure + event log |
| VDIS ingestion throughput | 1,000 events/min per node | Horizontal scaling via multiple VDIS instances |
| Entity Registry lookup | < 100ms | Direct PDA fetch via `getAccountInfo` |

### Scalability Notes

- **Account closure** — Consumed and Retired assets older than a configurable retention window can have their rent reclaimed by closing the account; the event log (in Solana transaction history) remains permanently accessible via Helius Enhanced APIs.
- **Horizontal VDIS scaling** — Multiple VDIS instances can operate concurrently; UUID uniqueness is enforced at the PDA derivation level (duplicate UUIDs produce the same PDA address and fail on `init`).
- **Rules Engine parallelism** — Attestation computations for independent assets are fully parallelizable. Worker pool scaling is handled by the off-chain orchestration layer (Kubernetes Jobs or AWS Batch).

---

## Security Considerations

| Threat | Mitigation |
|---|---|
| Forged ingestion event | HSM-signed VDIS transactions; entity authority Pubkey verified by Entity Registry CPI |
| FEOC entity bypassing flags | Oracle Service sets FEOC flags; entities cannot self-modify; Merkle list in PolicyProfile |
| Mass inflation / double-spend | Conservation checks at program level; Consumed status prevents reuse |
| Oracle manipulation | Oracle key is a multisig; published state roots are auditable against public source lists |
| Data exfiltration via metadata | Only SHA-256 hashes on-chain; raw data in IPFS behind access control |
| Replay attacks | Solana's built-in nonce/blockhash expiry; durable nonces for async VDIS submissions |
| Governance key compromise | Program authority is a multisig with timelock; upgrade authority frozen post-audit |

---

## Technology Stack Summary

| Layer | Technology |
|---|---|
| Blockchain | Solana (mainnet-beta) |
| Smart contracts | Anchor framework (Rust) |
| RPC provider | Helius |
| Frontend | React 18, TypeScript, Vite |
| Wallet integration | Wallet Adapter (Phantom, Backpack) |
| Off-chain services | Rust / Node.js microservices, Docker/Kubernetes |
| HSM | AWS CloudHSM / PKCS#11 |
| Metadata storage | IPFS (Filecoin-pinned) / permissioned S3 for classified |
| ERP integration | REST, GraphQL, EDI X12 |
| CI/CD | GitHub Actions, Anchor test suite |
