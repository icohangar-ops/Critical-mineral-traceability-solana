# CritMinChain — Data Model Specification

> **Status:** Living document · Last updated: 2026-03-28  
> **Audience:** Solana program developers, compliance engineers, integration architects

---

## Core Concepts

The data model is organized around five primitive types. All state that must be tamper-evident lives on-chain as Solana PDAs. Off-chain systems hold the full commercial payload; on-chain accounts hold only hashes, jurisdictional metadata, and computed compliance results.

### AssetID

A unique, deterministic identifier for a discrete lot of physical material at any stage of the supply chain — from raw ore to finished battery system. Implemented as a program-derived address (PDA) seeded by the program ID, the `AssetType` variant, and the off-chain UUID issued by the originating VDIS. The UUID is a UUID v4 generated at ingestion time and is globally unique across all entities and supply tiers. The PDA derivation ensures that a given UUID can only ever correspond to one on-chain account, preventing duplicate registration.

AssetID encompasses every trackable material unit:

- **Upstream feedstock** — ore lots, concentrate lots, refined metal lots
- **Mid-stream intermediates** — precursor batches, cathode batches
- **Downstream assemblies** — cell batches, pack assemblies, complete battery systems
- **Circular feedstock** — recycled feedstock re-entering the supply chain

### EntityID

A unique identifier for a legal entity or facility participating in the supply chain. Entity types span mines, concentrators, refiners, converters, cathode/cell/pack manufacturers, OEMs, recyclers, logistics providers, DoD depots, and auditors. Each entity has a single on-chain `EntityAccount` PDA that stores its jurisdiction, classification flags (domestic/allied/FEOC), CMMC maturity level, and links to credential records. The entity's `authority` field (a Solana Pubkey) is the key that must sign all instructions submitted on behalf of that entity.

EntityID is the trust anchor: every asset event is traceable to a registered, credentialed entity, and every compliance computation relies on the entity's on-chain classification flags.

### Event

An immutable on-chain record of a discrete supply chain action. Events come in two primary forms:

- **TransformationEvent** — records a physical or chemical process that consumes one or more input assets and produces one or more output assets (e.g., smelting, refining, cell assembly).
- **TransferEvent** — records a change of custody between two registered entities without physical transformation (e.g., a logistics handoff, a sale).

Events are append-only. Once written, they cannot be modified or deleted. They carry a SHA-256 hash of the full off-chain payload and an ed25519 signature from the originating entity's authority key.

### PolicyProfile

A versioned, on-chain configuration object that encodes the specific legal and regulatory requirements for a compliance calculation. A `PolicyProfile` specifies: which jurisdictions qualify as domestic or allied, the Merkle root of the current FEOC entity list, minimum domestic-content thresholds (separately for value-basis and mass-basis, expressed in basis points), and the policy's effective/expiry date window.

Multiple `PolicyProfile` versions may coexist simultaneously, enabling orderly transitions between regulatory periods (e.g., the IRA percentage ramp-up schedule from 2024 through 2029). The version is embedded in the PDA seed, so old records are always readable.

### Attestation

A cryptographically committed compliance result written on-chain by the authorized Compliance Rules Engine. An `AttestationRecord` stores the computed domestic and allied content percentages (in basis points), the `ComplianceStatus` enum, and a Merkle root over all upstream assets and their jurisdictional metadata used in the calculation. The Merkle root enables auditors to verify inclusion of specific upstream lots and replay the computation without trusting the platform.

---

## Asset Types

```rust
pub enum AssetType {
    OreLot,              // Raw extracted ore, pre-processing
    ConcentrateLot,      // Ore after physical beneficiation/concentration
    RefinedMetalLot,     // Hydrometallurgical or pyrometallurgical output
    PrecursorBatch,      // Mixed hydroxide precipitate (MHP) or equivalent
    CathodeBatch,        // Cathode active material (NMC, LFP, etc.)
    CellBatch,           // Individual electrochemical cells
    PackAssembly,        // Battery module or pack
    BatterySystem,       // Complete battery system (vehicle, stationary)
    RecycledFeedstock,   // End-of-life material re-entering as upstream node
}
```

**Notes:**
- `OreLot` is always a leaf node in the asset graph (no `parent_assets`).
- `RecycledFeedstock` may optionally reference source `BatterySystem` IDs in its `parent_assets` when the origin is known and traceable.
- `BatterySystem` is typically the terminal node for DoD procurement attestations.
- The transformation sequence in a typical lithium-ion supply chain follows: `OreLot → ConcentrateLot → RefinedMetalLot → PrecursorBatch → CathodeBatch → CellBatch → PackAssembly → BatterySystem`.

---

## Entity Types

```rust
pub enum EntityType {
    Mine,                  // Extractive operation; produces OreLot
    Concentrator,          // Physical beneficiation; OreLot → ConcentrateLot
    Refiner,               // Hydromet/pyromet processing; produces RefinedMetalLot
    Converter,             // Chemical conversion; produces PrecursorBatch
    CathodeManufacturer,   // Produces CathodeBatch
    CellManufacturer,      // Produces CellBatch
    PackAssembler,         // Produces PackAssembly
    OEM,                   // Original equipment manufacturer; produces BatterySystem
    Recycler,              // Produces RecycledFeedstock from end-of-life assets
    LogisticsProvider,     // Custody transfers only; does not transform assets
    DoDDepot,              // Defense logistics; DoD-specific receiving entity
    Auditor,               // Read-only participant; may verify but not write events
}
```

---

## Account Structures (Solana)

All accounts are Anchor `#[account]` structs. Space calculations must account for the 8-byte Anchor discriminator prefix.

### AssetAccount (PDA)

The primary on-chain record for a physical material lot.

```rust
#[account]
pub struct AssetAccount {
    /// Deterministic SHA-256 hash of the off-chain UUID (32 bytes).
    /// Used as a stable reference in parent_assets lists.
    pub asset_id: [u8; 32],

    /// Variant from AssetType enum. Encoded as u8.
    pub asset_type: AssetType,

    /// Pubkey of the EntityAccount currently holding custody.
    /// Updated on TransferEvent; must be a registered entity.
    pub owner_entity: Pubkey,

    /// Pubkey of the EntityAccount that originally produced this asset.
    /// Set at creation; immutable thereafter.
    pub origin_entity: Pubkey,

    /// SHA-256 hash of the off-chain metadata document (full payload in IPFS).
    /// Commits to: exact GPS coordinates, invoice data, assay results,
    /// counterparty names, and any other commercially sensitive fields.
    pub metadata_hash: [u8; 32],

    /// Ordered list of parent asset_ids (graph in-edges).
    /// Empty for leaf nodes (OreLot, RecycledFeedstock with no known origin).
    /// Maximum 32 parents per asset; deeper fan-in requires intermediate nodes.
    pub parent_assets: Vec<[u8; 32]>,

    /// Mass of this asset in milligrams (u64).
    /// Milligram precision prevents rounding errors in conservation checks
    /// across multi-tier aggregations. 1 metric ton = 1,000,000,000 mg.
    pub mass_mg: u64,

    /// Value of this asset in USD cents (u64).
    /// Derived from invoice data or, if unavailable, oracle price feed × mass.
    pub value_usd_cents: u64,

    /// ISO 3166-1 alpha-2 country code of the extraction or production jurisdiction.
    /// Two ASCII bytes (e.g., b"US", b"AU", b"CL").
    pub jurisdiction: [u8; 2],

    /// Unix timestamp (seconds since epoch) of asset creation on-chain.
    pub created_at: i64,

    /// Lifecycle state of this asset.
    pub status: AssetStatus,

    /// PDA bump seed, stored for efficient re-derivation.
    pub bump: u8,
}
```

**Space layout (approximate):**

| Field | Size (bytes) |
|---|---|
| Discriminator | 8 |
| asset_id | 32 |
| asset_type | 1 |
| owner_entity | 32 |
| origin_entity | 32 |
| metadata_hash | 32 |
| parent_assets (vec, 32 max) | 4 + 32×32 = 1028 |
| mass_mg | 8 |
| value_usd_cents | 8 |
| jurisdiction | 2 |
| created_at | 8 |
| status | 1 |
| bump | 1 |
| **Total** | **~1,195** |

---

### EntityAccount (PDA)

The identity and credential record for a supply chain participant.

```rust
#[account]
pub struct EntityAccount {
    /// Deterministic hash of the entity's canonical off-chain identifier
    /// (e.g., DUNS number, CAGE code, or platform-issued UUID).
    pub entity_id: [u8; 32],

    /// Variant from EntityType enum.
    pub entity_type: EntityType,

    /// Solana Pubkey that must sign all instructions submitted by this entity.
    /// May be a multisig (e.g., Squads) for higher-assurance entities.
    pub authority: Pubkey,

    /// ISO 3166-1 alpha-2 country code of the entity's primary operating jurisdiction.
    pub jurisdiction: [u8; 2],

    /// True if this entity is classified as a US domestic producer/processor
    /// under the applicable policy (e.g., IRA Section 30D definition).
    pub domestic_flag: bool,

    /// True if this entity is in a qualifying allied nation under
    /// DFARS 252.225 or the applicable FTA/bilateral agreement.
    pub allied_flag: bool,

    /// True if this entity is identified as a Foreign Entity of Concern
    /// under 10 USC 4872 or equivalent statute.
    /// Set exclusively by the Oracle Service; entity cannot self-modify.
    pub feoc_flag: bool,

    /// CMMC Maturity Level (0–3). 0 = not assessed or not applicable.
    /// Required for entities in DoD-facing supply chains.
    pub cmmc_level: u8,

    /// SHA-256 hash of the off-chain credential document bundle
    /// (facility audits, export-control clearances, certifications).
    pub metadata_hash: [u8; 32],

    /// Structured credential records attached to this entity.
    /// Maximum 16 credentials per entity.
    pub credentials: Vec<Credential>,

    /// Unix timestamp of entity registration.
    pub created_at: i64,

    /// PDA bump seed.
    pub bump: u8,
}

/// A single verifiable credential attached to an EntityAccount.
pub struct Credential {
    /// Credential type identifier (e.g., b"RMAP", b"ISO9001", b"CMMC3", b"ITAR").
    pub credential_type: [u8; 16],

    /// SHA-256 hash of the credential document.
    pub document_hash: [u8; 32],

    /// Unix timestamp when this credential expires. i64::MAX = no expiry.
    pub expiry: i64,

    /// Pubkey of the issuing authority (e.g., RMI, BSI, DCSA).
    pub issuer: Pubkey,
}
```

---

### TransformationEvent

An immutable record of a physical or chemical process that consumes input assets and produces output assets. Stored as a standalone account (not a PDA sub-account of the asset) to allow efficient enumeration by entity or transformation type.

```rust
#[account]
pub struct TransformationEvent {
    /// Unique event identifier: SHA-256(entity_pubkey || timestamp || nonce).
    pub event_id: [u8; 32],

    /// The type of physical or chemical process performed.
    pub transformation_type: TransformationType,

    /// asset_ids of all consumed input assets. These assets are set to
    /// status=Consumed by this instruction; they cannot appear as inputs again.
    pub input_assets: Vec<[u8; 32]>,

    /// asset_ids of all produced output assets. These assets must be initialized
    /// (via create_asset) in the same transaction or prior to this instruction.
    pub output_assets: Vec<[u8; 32]>,

    /// EntityAccount Pubkey of the entity performing the transformation.
    /// Must hold the appropriate role (e.g., ROLE_REFINER for Smelt/Refine).
    pub entity: Pubkey,

    /// SHA-256 hash of the off-chain transformation detail document:
    /// process parameters, equipment IDs, yield data, QC results, etc.
    pub metadata_hash: [u8; 32],

    /// Unix timestamp of the transformation event (wall clock of the
    /// originating facility, validated by the VDIS against block time).
    pub timestamp: i64,

    /// Ed25519 signature by the entity's authority key over the canonical
    /// serialization of this event (event_id || input_assets || output_assets
    /// || timestamp || metadata_hash). Provides non-repudiation.
    pub signature: [u8; 64],
}
```

**Conservation invariant (enforced by program):**

```
sum(input_asset.mass_mg) × (1 - yield_loss_tolerance)
  ≤ sum(output_asset.mass_mg)
  ≤ sum(input_asset.mass_mg) × (1 + yield_gain_tolerance)
```

Yield tolerances are defined per `TransformationType` in a program constant table (e.g., Concentrate: ±15%, Smelt: ±5%, CellAssembly: ±1%).

---

### TransferEvent

A lightweight event recording custody transfer without physical transformation.

```rust
#[account]
pub struct TransferEvent {
    pub event_id: [u8; 32],
    pub asset_id: [u8; 32],

    /// EntityAccount Pubkey of the outgoing custodian. Must sign the instruction.
    pub from_entity: Pubkey,

    /// EntityAccount Pubkey of the incoming custodian. Must be a registered entity.
    pub to_entity: Pubkey,

    /// SHA-256 hash of the off-chain transfer document (bill of lading,
    /// commercial invoice, customs declaration).
    pub metadata_hash: [u8; 32],

    pub timestamp: i64,

    /// Ed25519 signature by from_entity's authority key.
    pub signature: [u8; 64],
}
```

---

### PolicyProfile

The versioned on-chain encoding of a specific compliance policy. Managed by the platform governance multisig or a designated policy authority.

```rust
#[account]
pub struct PolicyProfile {
    /// Deterministic ID: SHA-256(policy_name || version).
    pub policy_id: [u8; 32],

    /// Human-readable name. Null-padded to 64 bytes.
    /// Example: "IRA-30D-Domestic-Content-2026-v2"
    pub name: [u8; 64],

    /// Semantic version (major × 1000 + minor). E.g., 2001 = v2.1.
    pub version: u16,

    /// List of ISO 3166-1 alpha-2 codes that qualify as domestic or allied
    /// under this policy. Used by the Rules Engine for jurisdiction matching.
    pub qualifying_jurisdictions: Vec<[u8; 2]>,

    /// Merkle root of the current FEOC entity list published by the Oracle Service.
    /// Any EntityAccount flagged feoc_flag=true must appear in this list.
    /// Rules Engine checks upstream entities against this list during attestation.
    pub feoc_entities: [u8; 32],

    /// Minimum qualifying domestic content by value. Expressed in basis points.
    /// Example: 5000 = 50.00%. A compliance result below this threshold
    /// receives ComplianceStatus::NonCompliant.
    pub min_domestic_pct_value: u16,

    /// Minimum qualifying domestic content by mass. Basis points.
    pub min_domestic_pct_mass: u16,

    /// Unix timestamp on which this policy version becomes effective.
    pub effective_date: i64,

    /// Unix timestamp after which attestations under this policy are Expired.
    /// i64::MAX indicates no scheduled expiry.
    pub expiry_date: i64,

    /// Pubkey authorized to update this PolicyProfile (governance key or multisig).
    pub authority: Pubkey,
}
```

---

### AttestationRecord

The on-chain compliance result for a specific asset under a specific policy. Written exclusively by the Compliance Rules Engine (oracle authority).

```rust
#[account]
pub struct AttestationRecord {
    /// Deterministic ID: SHA-256(asset_id || policy_id || timestamp).
    pub attestation_id: [u8; 32],

    /// The PackAssembly or BatterySystem asset being attested.
    pub asset_id: [u8; 32],

    /// The PolicyProfile under which this computation was performed.
    pub policy_id: [u8; 32],

    /// Computed domestic-qualifying content by value. Basis points.
    pub domestic_pct_value: u16,

    /// Computed domestic-qualifying content by mass. Basis points.
    pub domestic_pct_mass: u16,

    /// Computed allied-nation (non-domestic qualifying) content by value. Basis points.
    pub allied_pct_value: u16,

    /// Computed FEOC-tainted content by value. Basis points.
    /// Any value > 0 should trigger review; policy-specific thresholds apply.
    pub feoc_pct_value: u16,

    /// Overall compliance determination.
    pub compliance_status: ComplianceStatus,

    /// Merkle root over the full set of upstream (asset_id, jurisdiction, mass_mg,
    /// value_usd_cents) tuples used in this computation. Allows verifiers to
    /// request inclusion proofs for specific upstream lots.
    pub merkle_root: [u8; 32],

    /// EntityAccount Pubkey of the oracle/rules engine that signed this attestation.
    /// Must hold ROLE_ORACLE in the Entity Registry.
    pub attester: Pubkey,

    /// Unix timestamp of attestation computation.
    pub timestamp: i64,
}
```

---

## PDA Derivation Seeds

All PDAs are derived using `find_program_address` with the seeds below. The resulting bump is stored in the account and used for efficient re-derivation in CPI calls.

```
AssetAccount
  seeds: [b"asset", asset_type.to_le_bytes(), off_chain_uuid.as_bytes()]
  program: ASSET_GRAPH_PROGRAM_ID

EntityAccount
  seeds: [b"entity", entity_type.to_le_bytes(), authority.as_ref()]
  program: ENTITY_REGISTRY_PROGRAM_ID

PolicyProfile
  seeds: [b"policy", policy_name.as_bytes(), version.to_le_bytes().as_ref()]
  program: COMPLIANCE_ATTESTATION_PROGRAM_ID

AttestationRecord
  seeds: [b"attestation", asset_id.as_ref(), policy_id.as_ref()]
  program: COMPLIANCE_ATTESTATION_PROGRAM_ID

TransformationEvent
  seeds: [b"transform", event_id.as_ref()]
  program: ASSET_GRAPH_PROGRAM_ID

TransferEvent
  seeds: [b"transfer", event_id.as_ref()]
  program: ASSET_GRAPH_PROGRAM_ID
```

**Notes:**
- `off_chain_uuid` is UTF-8 encoded, 36 bytes (standard UUID v4 string format including hyphens).
- `policy_name` is limited to 32 bytes to stay within the 255-byte seed length limit.
- All seeds are passed as slices; Anchor's `seeds` constraint macro handles the concatenation.

---

## Enums

### AssetType

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum AssetType {
    OreLot            = 0,
    ConcentrateLot    = 1,
    RefinedMetalLot   = 2,
    PrecursorBatch    = 3,
    CathodeBatch      = 4,
    CellBatch         = 5,
    PackAssembly      = 6,
    BatterySystem     = 7,
    RecycledFeedstock = 8,
}
```

### EntityType

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EntityType {
    Mine                = 0,
    Concentrator        = 1,
    Refiner             = 2,
    Converter           = 3,
    CathodeManufacturer = 4,
    CellManufacturer    = 5,
    PackAssembler       = 6,
    OEM                 = 7,
    Recycler            = 8,
    LogisticsProvider   = 9,
    DoDDepot            = 10,
    Auditor             = 11,
}
```

### TransformationType

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TransformationType {
    /// Physical extraction from earth. OreLot creation only.
    Extract            = 0,

    /// Physical beneficiation: crushing, grinding, flotation.
    /// OreLot → ConcentrateLot.
    Concentrate        = 1,

    /// Pyrometallurgical or hydrometallurgical refining.
    /// ConcentrateLot → RefinedMetalLot.
    Smelt              = 2,

    /// High-purity hydrometallurgical refining.
    Refine             = 3,

    /// Chemical conversion to precursor material (e.g., MHP, MSO4).
    /// RefinedMetalLot → PrecursorBatch.
    Convert            = 4,

    /// Cathode active material synthesis.
    /// PrecursorBatch → CathodeBatch.
    CathodeManufacture = 5,

    /// Electrochemical cell assembly.
    /// CathodeBatch (+ anode materials) → CellBatch.
    CellAssembly       = 6,

    /// Battery module and pack assembly.
    /// CellBatch → PackAssembly.
    PackAssembly       = 7,

    /// Integration of pack into a complete system.
    /// PackAssembly → BatterySystem.
    SystemIntegration  = 8,

    /// End-of-life material intake at a recycler.
    /// BatterySystem (or PackAssembly) → intermediate (status change only).
    RecycleIn          = 9,

    /// Recycled material output ready for re-entry into supply chain.
    /// Intermediate → RecycledFeedstock.
    RecycleOut         = 10,

    /// Pure custody transfer. No transformation. Uses TransferEvent, not
    /// TransformationEvent; included here for event log completeness.
    Transfer           = 11,
}
```

### AssetStatus

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum AssetStatus {
    /// Asset exists, has a current custodian, and has not been processed further.
    Active      = 0,

    /// Asset has been fully consumed as input to a TransformationEvent.
    /// No further events may reference this asset as an input.
    Consumed    = 1,

    /// Asset has been transferred to a new custodian (owner_entity updated).
    /// Asset may still be Active after transfer; Transferred is a transient
    /// state used in event logs, not stored on AssetAccount.
    Transferred = 2,

    /// Asset has been intentionally retired (e.g., warranty return, loss, destruction).
    /// Requires an authorized retirement event with supporting documentation hash.
    Retired     = 3,
}
```

### ComplianceStatus

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ComplianceStatus {
    /// All policy thresholds met; no FEOC taint detected.
    Compliant      = 0,

    /// One or more thresholds not met, or FEOC-tainted content detected.
    NonCompliant   = 1,

    /// Computation triggered but upstream data incomplete or conflicting.
    /// Manual review by authorized auditor required before determination.
    PendingReview  = 2,

    /// Attestation was previously Compliant but the PolicyProfile has expired
    /// or the oracle has published an updated FEOC list that affects upstream entities.
    /// Re-attestation required.
    Expired        = 3,
}
```

### Role

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum Role {
    /// Can create OreLot assets; initiate Extract events.
    Miner       = 0,

    /// Can create downstream asset types; initiate transformation events.
    Refiner     = 1,

    /// Can create PackAssembly and BatterySystem; initiate final assembly events.
    OEM         = 2,

    /// Read-only access to all accounts; can request attestation proofs.
    DoDVerifier = 3,

    /// Read-only access; can export credential and attestation packages.
    Auditor     = 4,

    /// Can write AttestationRecord and update PolicyProfile FEOC Merkle roots.
    Oracle      = 5,

    /// Can register entities, assign roles, and update PolicyProfiles.
    /// Should be a multisig; tightly controlled.
    Admin       = 6,
}
```

---

## Relationships Diagram

The following ASCII diagram shows the primary relationships between accounts in the data model. Arrows indicate ownership, reference, or logical dependency.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY LAYER                                      │
│                                                                             │
│   ┌──────────────────┐         ┌────────────────┐                          │
│   │  EntityAccount   │         │   Credential   │                          │
│   │  (PDA)           │ 1 ──── * │   (inline)     │                          │
│   │                  │         │                │                          │
│   │  entity_id       │         │  credential_   │                          │
│   │  entity_type     │         │  type          │                          │
│   │  authority       │         │  document_hash │                          │
│   │  jurisdiction    │         │  expiry        │                          │
│   │  domestic_flag   │         │  issuer        │                          │
│   │  allied_flag     │         └────────────────┘                          │
│   │  feoc_flag       │                                                      │
│   │  cmmc_level      │                                                      │
│   └────────┬─────────┘                                                      │
└────────────┼────────────────────────────────────────────────────────────────┘
             │ owns / signs
             │ (owner_entity / origin_entity)
             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ASSET LAYER                                       │
│                                                                             │
│   ┌──────────────────┐   parent_assets   ┌──────────────────┐              │
│   │  AssetAccount    │ ◄──────────────── │  AssetAccount    │              │
│   │  (PDA) [Leaf]    │                   │  (PDA) [Mid]     │              │
│   │                  │                   │                  │              │
│   │  asset_type:     │                   │  asset_type:     │              │
│   │  OreLot          │   parent_assets   │  RefinedMetalLot │              │
│   │  jurisdiction:US │ ◄──────────────── │                  │              │
│   │  status: Consumed│                   │  status: Consumed│              │
│   └──────────────────┘                   └────────┬─────────┘              │
│                                                    │ parent_assets          │
│                                                    ▼                        │
│                                          ┌──────────────────┐              │
│                                          │  AssetAccount    │              │
│                                          │  (PDA) [Terminal]│              │
│                                          │                  │              │
│                                          │  asset_type:     │              │
│                                          │  PackAssembly    │              │
│                                          │  status: Active  │              │
│                                          └────────┬─────────┘              │
└───────────────────────────────────────────────────┼─────────────────────────┘
                                                    │
                            ┌───────────────────────┼────────────────────────┐
                            │                       │                        │
                            ▼                       ▼                        │
┌──────────────────────┐   ┌─────────────────────────────────────────────┐  │
│  TransformationEvent │   │            COMPLIANCE LAYER                 │  │
│  (PDA)               │   │                                             │  │
│                      │   │  ┌─────────────────┐   ┌─────────────────┐ │  │
│  input_assets ───────┼──►│  │  PolicyProfile  │   │ AttestationRecord│ │  │
│  output_assets ◄─────┼───│  │  (PDA)          │   │ (PDA)           │ │  │
│  entity (FK)         │   │  │                 │   │                 │ │  │
│  transformation_type │   │  │  policy_id      │──►│  policy_id (FK) │ │  │
│  metadata_hash       │   │  │  qualifying_    │   │  asset_id  (FK) │ │  │
│  signature           │   │  │  jurisdictions  │   │  domestic_pct_  │ │  │
└──────────────────────┘   │  │  feoc_entities  │   │  value          │ │  │
                            │  │  min_domestic_  │   │  compliance_    │ │  │
┌──────────────────────┐   │  │  pct_value      │   │  status         │ │  │
│  TransferEvent       │   │  │  expiry_date    │   │  merkle_root    │ │  │
│  (PDA)               │   │  └─────────────────┘   │  attester (FK)  │ │  │
│                      │   │                         └─────────────────┘ │  │
│  asset_id (FK)       │   └─────────────────────────────────────────────┘  │
│  from_entity (FK)    │                                                      │
│  to_entity (FK)      │   Legend:                                           │
│  signature           │   ──►  references / foreign key                     │
└──────────────────────┘   ◄──  parent_assets graph edge (DAG)               │
                                1 ──── *  one-to-many (inline)               │
                                (FK)  foreign key reference                  │
```

---

## Compliance Calculation Methodology

The Rules Engine computes domestic content as follows for a given terminal asset `T` and `PolicyProfile P`:

### Step 1 — Graph Traversal

Perform a depth-first traversal of the asset DAG starting at `T`, following `parent_assets` links recursively until leaf nodes (empty `parent_assets`) are reached. Collect the complete set of upstream nodes `U = {u₁, u₂, ..., uₙ}`.

### Step 2 — Jurisdiction Resolution

For each node `uᵢ`:
1. Fetch `uᵢ.owner_entity` → look up `EntityAccount.jurisdiction` and `EntityAccount.feoc_flag`.
2. Check if `uᵢ.jurisdiction` is in `P.qualifying_jurisdictions`.
3. Check if `EntityAccount.feoc_flag = true` (disqualifies, regardless of jurisdiction).

### Step 3 — Value and Mass Apportionment

For value-basis calculation:

```
domestic_value = Σ { uᵢ.value_usd_cents | jurisdiction(uᵢ) ∈ P.qualifying_jurisdictions
                                         ∧ feoc_flag(owner(uᵢ)) = false }

total_value    = Σ { uᵢ.value_usd_cents | uᵢ ∈ U }

domestic_pct_value (basis points) = (domestic_value × 10000) / total_value
```

Mass-basis calculation follows the same structure using `mass_mg`.

### Step 4 — FEOC Taint Detection

```
feoc_value = Σ { uᵢ.value_usd_cents | feoc_flag(owner(uᵢ)) = true }
feoc_pct_value (basis points) = (feoc_value × 10000) / total_value
```

Any `feoc_pct_value > 0` is flagged; policy-specific zero-tolerance thresholds may force `ComplianceStatus::NonCompliant`.

### Step 5 — Determination

```
if domestic_pct_value >= P.min_domestic_pct_value
   AND domestic_pct_mass >= P.min_domestic_pct_mass
   AND feoc_pct_value = 0:
     status = Compliant
elif upstream_data_incomplete:
     status = PendingReview
else:
     status = NonCompliant
```

### Step 6 — Merkle Commitment

Build a binary Merkle tree where each leaf is:

```
leaf_i = SHA-256(uᵢ.asset_id || uᵢ.jurisdiction || uᵢ.mass_mg.to_le_bytes() || uᵢ.value_usd_cents.to_le_bytes())
```

Leaves are sorted by `asset_id` before tree construction to ensure deterministic root computation. The root is stored in `AttestationRecord.merkle_root`.

---

## Design Invariants

The following invariants are enforced at the program level and must not be violated by any instruction handler:

1. **No asset appears as input to more than one non-retired TransformationEvent.** Once an asset's status is set to `Consumed`, the program rejects any instruction referencing it as an input.
2. **Mass conservation.** The sum of output asset masses must be within the yield tolerance of the sum of input asset masses for any `TransformationEvent`.
3. **Jurisdiction immutability.** An asset's `jurisdiction` field is set at creation and cannot be changed. Jurisdiction reflects where the material was produced, not where custody currently lies.
4. **FEOC flag authority.** Only the registered Oracle authority (holding `ROLE_ORACLE`) may set or clear `feoc_flag` on an `EntityAccount`. Entity self-modification of this field is rejected.
5. **Attestation immutability.** `AttestationRecord` PDAs are write-once. Re-attestation creates a new record with a new `attestation_id` (timestamp-disambiguated); old records are preserved for audit continuity.
6. **Role gate enforcement.** Every instruction that writes state must validate the caller's role via CPI to the Entity Registry before executing any mutations.
