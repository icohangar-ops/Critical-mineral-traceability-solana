# Solana Program Specifications

## Overview

Three Anchor programs are deployed on Solana mainnet as the on-chain core of CritMinChain. All programs are written in Rust using the [Anchor framework](https://www.anchor-lang.com/). Each program uses Program Derived Addresses (PDAs) for deterministic account addressing and emits structured events for off-chain indexer consumption.

| Program | Program ID (Devnet) | Description |
|---|---|---|
| `asset_provenance` | TBD | Tracks asset lifecycle: creation, transformation, transfer |
| `compliance_attestation` | TBD | Stores policy definitions and compliance attestation records |
| `entity_registry` | TBD | Manages entity registration, credentials, and role assignments |

All programs share a common governance authority pubkey configured at deployment. Cross-program invocations (CPIs) are used where programs must validate state from one another (e.g., `compliance_attestation` reads entity roles from `entity_registry`).

---

## Program 1: `asset_provenance`

Manages the full lifecycle of a critical mineral asset from extraction through end-use. Assets are represented as PDAs keyed by a 32-byte asset ID. Transformation and transfer instructions enforce mass conservation and custody chain integrity.

### Account Structures

```rust
#[account]
pub struct AssetAccount {
    pub asset_id: [u8; 32],
    pub asset_type: AssetType,
    pub metadata_hash: [u8; 32],      // IPFS CID or SHA-256 of off-chain metadata
    pub mass_kg: u64,
    pub value_usd_cents: u64,
    pub jurisdiction: [u8; 2],        // ISO 3166-1 alpha-2
    pub owner_entity: Pubkey,
    pub creator_entity: Pubkey,
    pub status: AssetStatus,
    pub parent_assets: Vec<[u8; 32]>, // empty for leaf/raw extraction assets
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum AssetStatus {
    Active,
    Consumed,     // used as input in a transformation
    Transferred,  // ownership changed; asset still active
    Retired,      // end-of-life, no further operations permitted
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum AssetType {
    RawOre,
    Concentrate,
    Precursor,
    ActiveMaterial,
    CellComponent,
    BatteryCell,
    BatteryModule,
    BatteryPack,
    Other,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum TransformationType {
    Mining,
    Crushing,
    Refining,
    Smelting,
    ChemicalProcessing,
    CellAssembly,
    ModuleAssembly,
    PackAssembly,
    Recycling,
    Other,
}
```

PDA derivation:

```rust
seeds = [b"asset", asset_id.as_ref()]
```

---

### Instructions

#### `create_asset`

Creates a new `AssetAccount` PDA representing a newly identified asset (e.g., a freshly extracted mineral lot).

```rust
pub fn create_asset(
    ctx: Context<CreateAsset>,
    asset_id: [u8; 32],
    asset_type: AssetType,
    metadata_hash: [u8; 32],
    mass_kg: u64,
    value_usd_cents: u64,
    jurisdiction: [u8; 2],
) -> Result<()>
```

**Validation:**
- Caller (`ctx.accounts.authority`) must be a registered entity in `entity_registry` with role `EntityRole::AssetCreator` or higher.
- `asset_id` must not already exist (PDA must be uninitialized).
- `mass_kg` must be non-zero.
- `jurisdiction` must be a recognized ISO 3166-1 alpha-2 code.

**State changes:**
- Initializes `AssetAccount` with `status = AssetStatus::Active`, `owner_entity = caller`, `parent_assets = []`.

**Emits:** `AssetCreated`

**Context accounts:**

```rust
#[derive(Accounts)]
#[instruction(asset_id: [u8; 32])]
pub struct CreateAsset<'info> {
    #[account(
        init,
        payer = payer,
        space = AssetAccount::LEN,
        seeds = [b"asset", asset_id.as_ref()],
        bump,
    )]
    pub asset_account: Account<'info, AssetAccount>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

---

#### `transform_assets`

Consumes one or more input assets and creates one or more output assets, recording a transformation event (e.g., refining ore into concentrate).

```rust
pub fn transform_assets(
    ctx: Context<TransformAssets>,
    output_asset_ids: Vec<[u8; 32]>,
    transformation_type: TransformationType,
    metadata_hash: [u8; 32],
) -> Result<()>
```

**Validation:**
- Caller must own all input assets (each input `AssetAccount.owner_entity == caller pubkey`).
- All input assets must have `status == AssetStatus::Active`.
- `output_asset_ids` must be non-empty; each ID must not already exist.
- **Conservation rule:** `sum(output.mass_kg) <= sum(input.mass_kg) * (1 + yield_tolerance_bps / 10000)`. The `yield_tolerance_bps` parameter is stored in a program config account and configurable by governance (default: 0 — no gain permitted; losses allowed to model yield/waste).
- `transformation_type` must be consistent with the `AssetType` transition (enforced via a validity matrix; e.g., `PackAssembly` cannot produce `RawOre`).

**State changes:**
- Sets `status = AssetStatus::Consumed` and `updated_at = Clock::get().unix_timestamp` on each input `AssetAccount`.
- Initializes each output `AssetAccount` with:
  - `parent_assets` populated with the input `asset_id` values.
  - `owner_entity = caller`.
  - `jurisdiction` inherited from the caller's entity jurisdiction (overridable for multi-jurisdiction processing facilities).
  - `status = AssetStatus::Active`.

**Emits:** `TransformationRecorded`

**Context accounts:**

```rust
#[derive(Accounts)]
pub struct TransformAssets<'info> {
    // remaining_accounts used for dynamic input/output asset accounts
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

> Input and output `AssetAccount`s are passed via `ctx.remaining_accounts` due to the variable-length nature of the instruction. The program validates each account's PDA derivation and ownership inline.

---

#### `transfer_asset`

Transfers custody of an asset from the current owner entity to a new entity.

```rust
pub fn transfer_asset(
    ctx: Context<TransferAsset>,
    asset_id: [u8; 32],
    to_entity: Pubkey,
    shipment_metadata_hash: [u8; 32],
) -> Result<()>
```

**Validation:**
- Caller must be the current `owner_entity` of the asset.
- Asset must have `status == AssetStatus::Active`.
- `to_entity` must be a registered entity in `entity_registry` with `status == EntityStatus::Active` (CPI call to `entity_registry`).
- `shipment_metadata_hash` must be non-zero (enforces that transfer documentation is recorded off-chain).

**State changes:**
- Sets `asset_account.owner_entity = to_entity`.
- Sets `asset_account.updated_at = Clock::get().unix_timestamp`.

**Emits:** `AssetTransferred`

---

### Events

All events are emitted via Anchor's `emit!` macro and indexed by the off-chain indexer service.

```rust
#[event]
pub struct AssetCreated {
    pub asset_id: [u8; 32],
    pub asset_type: AssetType,
    pub entity: Pubkey,
    pub mass_kg: u64,
    pub jurisdiction: [u8; 2],
    pub timestamp: i64,
}

#[event]
pub struct TransformationRecorded {
    pub input_assets: Vec<[u8; 32]>,
    pub output_assets: Vec<[u8; 32]>,
    pub transformation_type: TransformationType,
    pub entity: Pubkey,
    pub metadata_hash: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct AssetTransferred {
    pub asset_id: [u8; 32],
    pub from_entity: Pubkey,
    pub to_entity: Pubkey,
    pub shipment_metadata_hash: [u8; 32],
    pub timestamp: i64,
}
```

---

### Error Codes

```rust
#[error_code]
pub enum AssetProvenanceError {
    #[msg("An asset with this ID already exists.")]
    AssetAlreadyExists,

    #[msg("Asset account not found.")]
    AssetNotFound,

    #[msg("Asset is not in Active status.")]
    AssetNotActive,

    #[msg("Caller is not authorized to perform this action on the asset.")]
    UnauthorizedEntity,

    #[msg("Mass conservation violation: output mass exceeds input mass beyond yield tolerance.")]
    ConservationViolation,

    #[msg("Transformation type is not valid for the given asset type combination.")]
    InvalidTransformationType,

    #[msg("Asset type is not valid for this instruction.")]
    InvalidAssetType,

    #[msg("Mass must be greater than zero.")]
    ZeroMass,

    #[msg("Jurisdiction code is not recognized.")]
    InvalidJurisdiction,

    #[msg("Target entity is not registered or is not active.")]
    InvalidTargetEntity,
}
```

---

## Program 2: `compliance_attestation`

Stores policy definitions (domestic content thresholds, FEOC exclusion parameters) and on-chain attestation records produced by the off-chain Compliance Rules Engine.

### Account Structures

```rust
#[account]
pub struct PolicyAccount {
    pub policy_id: [u8; 32],
    pub name: String,                              // max 64 bytes
    pub version: u16,
    pub qualifying_jurisdictions: Vec<[u8; 2]>,   // ISO 3166-1 codes classified as "domestic" under this policy
    pub feoc_merkle_root: [u8; 32],               // signed root of current FEOC entity list
    pub min_domestic_pct_value: u16,              // basis points (e.g., 4000 = 40%)
    pub min_domestic_pct_mass: u16,
    pub effective_date: i64,
    pub expiry_date: i64,
    pub authority: Pubkey,                         // governance authority that created this policy
    pub bump: u8,
}

#[account]
pub struct AttestationRecord {
    pub asset_id: [u8; 32],
    pub policy_id: [u8; 32],
    pub attester: Pubkey,
    pub domestic_pct_value: u16,
    pub domestic_pct_mass: u16,
    pub allied_pct_value: u16,
    pub compliance_status: ComplianceStatus,
    pub feoc_violation: bool,
    pub merkle_root: [u8; 32],    // root of attestation input data tree
    pub revoked: bool,
    pub revocation_reason: Option<RevocationReason>,
    pub attested_at: i64,
    pub revoked_at: Option<i64>,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum ComplianceStatus {
    Compliant,
    NonCompliant,
    PendingReview,
    Revoked,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum RevocationReason {
    DataError,
    FraudDetected,
    PolicySuperseded,
    AuditFinding,
    Other,
}
```

PDA derivation:

```rust
// Policy
seeds = [b"policy", policy_id.as_ref()]

// Attestation
seeds = [b"attestation", asset_id.as_ref(), policy_id.as_ref()]
```

---

### Instructions

#### `create_policy`

Creates a new `PolicyAccount` representing a versioned domestic content policy.

```rust
pub fn create_policy(
    ctx: Context<CreatePolicy>,
    policy_id: [u8; 32],
    name: String,
    version: u16,
    qualifying_jurisdictions: Vec<[u8; 2]>,
    feoc_merkle_root: [u8; 32],
    min_domestic_pct_value: u16,
    min_domestic_pct_mass: u16,
    effective_date: i64,
    expiry_date: i64,
) -> Result<()>
```

**Validation:**
- Caller must be the program's designated governance authority.
- `policy_id` must not already exist.
- `effective_date < expiry_date`.
- `min_domestic_pct_value` and `min_domestic_pct_mass` must be in range `[0, 10000]` (basis points).
- `name` must be non-empty and at most 64 bytes.

**Emits:** `PolicyCreated`

---

#### `update_policy`

Updates mutable fields of an existing policy (e.g., to rotate the FEOC merkle root or adjust threshold schedules). Creates a new version rather than mutating the original.

```rust
pub fn update_policy(
    ctx: Context<UpdatePolicy>,
    policy_id: [u8; 32],
    new_feoc_merkle_root: Option<[u8; 32]>,
    new_min_domestic_pct_value: Option<u16>,
    new_min_domestic_pct_mass: Option<u16>,
    new_expiry_date: Option<i64>,
) -> Result<()>
```

**Validation:** Caller must be governance authority.

**Emits:** `PolicyUpdated`

---

#### `attest_compliance`

Writes an `AttestationRecord` PDA for a specific asset under a specific policy. Called exclusively by the authorized off-chain Compliance Rules Engine keypair.

```rust
pub fn attest_compliance(
    ctx: Context<AttestCompliance>,
    asset_id: [u8; 32],
    policy_id: [u8; 32],
    domestic_pct_value: u16,
    domestic_pct_mass: u16,
    allied_pct_value: u16,
    compliance_status: ComplianceStatus,
    merkle_root: [u8; 32],
) -> Result<()>
```

**Validation:**
- Caller must hold the `Role::AttestationService` role in `entity_registry`.
- Referenced `PolicyAccount` must exist and must be within `[effective_date, expiry_date]` at the current clock timestamp.
- No `AttestationRecord` PDA may already exist for this `(asset_id, policy_id)` pair (attestations are immutable; re-evaluation creates a new record via `revoke_attestation` + `attest_compliance`).
- `domestic_pct_value`, `domestic_pct_mass`, `allied_pct_value` must be in range `[0, 10000]`.
- If `compliance_status == ComplianceStatus::Compliant`, both `domestic_pct_value >= policy.min_domestic_pct_value` and `domestic_pct_mass >= policy.min_domestic_pct_mass` must hold.

**State changes:**
- Initializes `AttestationRecord` with `revoked = false`, `attested_at = Clock::get().unix_timestamp`.

**Emits:** `ComplianceAttested`

---

#### `revoke_attestation`

Marks an existing `AttestationRecord` as revoked. Does not delete the account — the revocation is a permanent audit event.

```rust
pub fn revoke_attestation(
    ctx: Context<RevokeAttestation>,
    asset_id: [u8; 32],
    policy_id: [u8; 32],
    reason: RevocationReason,
) -> Result<()>
```

**Validation:**
- Caller must hold `Role::Governance` or `Role::Auditor` in `entity_registry`.
- `AttestationRecord` must exist and `revoked == false`.

**State changes:**
- Sets `revoked = true`, `revocation_reason = Some(reason)`, `revoked_at = Some(Clock::get().unix_timestamp)`, `compliance_status = ComplianceStatus::Revoked`.

**Emits:** `AttestationRevoked`

---

### Events

```rust
#[event]
pub struct PolicyCreated {
    pub policy_id: [u8; 32],
    pub name: String,
    pub version: u16,
    pub effective_date: i64,
    pub expiry_date: i64,
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PolicyUpdated {
    pub policy_id: [u8; 32],
    pub version: u16,
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ComplianceAttested {
    pub asset_id: [u8; 32],
    pub policy_id: [u8; 32],
    pub compliance_status: ComplianceStatus,
    pub domestic_pct_value: u16,
    pub domestic_pct_mass: u16,
    pub merkle_root: [u8; 32],
    pub attester: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AttestationRevoked {
    pub asset_id: [u8; 32],
    pub policy_id: [u8; 32],
    pub reason: RevocationReason,
    pub revoker: Pubkey,
    pub timestamp: i64,
}
```

---

### Error Codes

```rust
#[error_code]
pub enum ComplianceAttestationError {
    #[msg("No policy found with the given ID.")]
    PolicyNotFound,

    #[msg("Policy has expired or is not yet effective.")]
    PolicyExpired,

    #[msg("Caller is not an authorized attestation service.")]
    UnauthorizedAttester,

    #[msg("An attestation already exists for this asset/policy pair.")]
    AttestationAlreadyExists,

    #[msg("Compliance data is invalid or inconsistent with policy thresholds.")]
    InvalidComplianceData,

    #[msg("Attestation has already been revoked.")]
    AlreadyRevoked,

    #[msg("Caller is not authorized to revoke attestations.")]
    UnauthorizedRevoker,

    #[msg("Percentage value out of range (must be 0–10000 basis points).")]
    InvalidPercentage,
}
```

---

## Program 3: `entity_registry`

Manages registration and credentialing of all supply chain participants. Acts as the shared authority and access-control layer consumed via CPI by `asset_provenance` and `compliance_attestation`.

### Account Structures

```rust
#[account]
pub struct EntityAccount {
    pub entity_id: [u8; 32],
    pub entity_type: EntityType,
    pub jurisdiction: [u8; 2],
    pub metadata_hash: [u8; 32],   // off-chain KYB documentation hash
    pub wallet: Pubkey,            // authorized signing key for this entity
    pub domestic_flag: bool,       // classified as US domestic
    pub allied_flag: bool,         // classified as FTA partner / trusted ally
    pub feoc_flag: bool,           // entity or parent is a FEOC
    pub cmmc_level: u8,            // 0 = none, 1–3 = CMMC levels
    pub credential_hash: [u8; 32], // hash of auditor-verified credential set
    pub roles: Vec<EntityRole>,
    pub status: EntityStatus,
    pub registered_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum EntityType {
    Miner,
    Processor,
    Refiner,
    CellManufacturer,
    PackManufacturer,
    OEM,
    LogisticsProvider,
    Auditor,
    GovernmentAgency,
    Other,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum EntityRole {
    AssetCreator,
    AssetTransferor,
    AttestationService,
    Auditor,
    Governance,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum EntityStatus {
    Active,
    Suspended,
    Revoked,
}
```

PDA derivation:

```rust
seeds = [b"entity", entity_id.as_ref()]
```

---

### Instructions

#### `register_entity`

Registers a new supply chain entity.

```rust
pub fn register_entity(
    ctx: Context<RegisterEntity>,
    entity_id: [u8; 32],
    entity_type: EntityType,
    jurisdiction: [u8; 2],
    metadata_hash: [u8; 32],
) -> Result<()>
```

**Validation:**
- `entity_id` must not already exist.
- `jurisdiction` must be a recognized ISO 3166-1 alpha-2 code.
- `metadata_hash` must be non-zero (enforces off-chain KYB documentation submission).
- Caller becomes the entity's initial `wallet` (signing key).

**State changes:**
- Initializes `EntityAccount` with `status = EntityStatus::Active`, `roles = []`, all credential flags `false`, `cmmc_level = 0`.

**Emits:** `EntityRegistered`

---

#### `update_credentials`

Updates the verified credential flags and CMMC level of a registered entity. Only callable by governance or a credentialed auditor.

```rust
pub fn update_credentials(
    ctx: Context<UpdateCredentials>,
    entity_id: [u8; 32],
    domestic_flag: bool,
    allied_flag: bool,
    feoc_flag: bool,
    cmmc_level: u8,
    credential_hash: [u8; 32],
) -> Result<()>
```

**Validation:**
- Caller must hold `Role::Governance` or `Role::Auditor`.
- `cmmc_level` must be in range `[0, 3]`.
- `domestic_flag` and `allied_flag` cannot both be `true` simultaneously (a domestic entity is not separately classified as allied).
- `feoc_flag` and `domestic_flag` cannot both be `true`.
- `credential_hash` must be non-zero.

**Emits:** `CredentialsUpdated`

---

#### `assign_role`

Assigns or revokes a role for an entity's wallet.

```rust
pub fn assign_role(
    ctx: Context<AssignRole>,
    entity_id: [u8; 32],
    role: EntityRole,
    grant: bool,   // true = grant, false = revoke
) -> Result<()>
```

**Validation:**
- Caller must hold `Role::Governance`.
- `EntityRole::Governance` may only be granted by an existing governance key (prevents privilege escalation).
- Entity must have `status == EntityStatus::Active`.

**Emits:** `RoleAssigned`

---

#### `suspend_entity`

Suspends or reinstates an entity. Suspended entities cannot create or transfer assets.

```rust
pub fn suspend_entity(
    ctx: Context<SuspendEntity>,
    entity_id: [u8; 32],
    suspend: bool,
    reason_hash: [u8; 32],
) -> Result<()>
```

**Validation:** Caller must hold `Role::Governance` or `Role::Auditor`.

**Emits:** `EntitySuspended`

---

### Events

```rust
#[event]
pub struct EntityRegistered {
    pub entity_id: [u8; 32],
    pub entity_type: EntityType,
    pub jurisdiction: [u8; 2],
    pub wallet: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct CredentialsUpdated {
    pub entity_id: [u8; 32],
    pub domestic_flag: bool,
    pub allied_flag: bool,
    pub feoc_flag: bool,
    pub cmmc_level: u8,
    pub updated_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RoleAssigned {
    pub entity_id: [u8; 32],
    pub role: EntityRole,
    pub grant: bool,
    pub assigned_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct EntitySuspended {
    pub entity_id: [u8; 32],
    pub suspended: bool,
    pub reason_hash: [u8; 32],
    pub authority: Pubkey,
    pub timestamp: i64,
}
```

---

### Error Codes

```rust
#[error_code]
pub enum EntityRegistryError {
    #[msg("An entity with this ID is already registered.")]
    EntityAlreadyExists,

    #[msg("No entity found with the given ID.")]
    EntityNotFound,

    #[msg("Caller is not authorized to perform this action.")]
    UnauthorizedCaller,

    #[msg("Entity type is not valid.")]
    InvalidEntityType,

    #[msg("CMMC level must be in range 0–3.")]
    InvalidCMMCLevel,

    #[msg("Conflicting credential flags (e.g., domestic and FEOC cannot both be true).")]
    ConflictingFlags,

    #[msg("Entity is not in Active status.")]
    EntityNotActive,

    #[msg("Jurisdiction code is not recognized.")]
    InvalidJurisdiction,
}
```

---

## Testing Strategy

### Unit Tests (Anchor Test Framework)

Each instruction is covered by isolated unit tests using `anchor test` with a local validator. Test categories per instruction:

| Category | Examples |
|---|---|
| Happy path | Valid inputs produce correct state and events |
| Authorization | Non-owner / wrong-role callers are rejected |
| Constraint violations | Zero mass, expired policy, duplicate IDs |
| Conservation | Output mass > input mass rejected; loss allowed |
| PDA derivation | Accounts derived with wrong seeds are rejected |

### Integration Tests (Local Validator)

Multi-program interaction tests run against `solana-test-validator` with all three programs deployed:

- Full supply chain flow: register entities → create raw asset → transform → transfer → attest compliance
- Role propagation: entity suspended mid-chain blocks further operations
- Cross-program CPI: `asset_provenance` correctly rejects transfer to suspended entity via `entity_registry` CPI
- FEOC propagation: asset with upstream FEOC entity correctly yields `NonCompliant` attestation

### Property-Based Tests

Using a property-testing library (e.g., `proptest`) over randomized inputs:

- **Conservation invariant:** For all valid transformations, `sum(output.mass_kg) <= sum(input.mass_kg) * (1 + tolerance)` always holds.
- **PDA determinism:** For any `(seed, program_id)` pair, `find_program_address` always returns the same address.
- **Attestation immutability:** Once written, an `AttestationRecord` cannot be mutated except by `revoke_attestation`, and revocation is a one-way transition.
- **Event completeness:** Every state-changing instruction emits exactly one event.

### Security Tests

- Unauthorized access: all instruction callers without required roles receive `UnauthorizedEntity` / `UnauthorizedCaller`.
- Integer overflow: `mass_kg` and `value_usd_cents` arithmetic uses `checked_add` / `checked_mul` throughout; overflow returns an error.
- Account substitution: passing a correctly-derived but wrong-program-owned account fails anchor constraint checks.
- Reentrancy: Solana's single-threaded execution model prevents reentrancy; CPIs are validated for expected program IDs.

---

## Deployment

### Build and Verify

```bash
anchor build
# Verify program hash matches audited binary
solana-verify build --library-name asset_provenance
solana-verify build --library-name compliance_attestation
solana-verify build --library-name entity_registry
```

### Devnet Deployment

```bash
anchor deploy --provider.cluster devnet
```

### Mainnet Deployment

```bash
anchor deploy --provider.cluster mainnet-beta --provider.wallet /path/to/deployer.json
```

### Upgrade Authority

All three programs use a multi-signature upgrade authority:

- **Threshold:** 3-of-5 signatures required
- **Key composition (production):** At minimum 1 key held by a government or accredited auditor stakeholder; remaining keys held by CritMinChain engineering leads
- **Upgrade process:** Proposed upgrade submitted as a governance proposal; 48-hour timelock before execution; all signers verify `solana-verify`-confirmed binary hash before signing

### Config Accounts

Program config accounts (yield tolerance, governance authority pubkey, attester pubkey) are initialized in a separate `initialize` instruction callable only once. Config is upgradeable via a `set_config` instruction gated to the governance multi-sig.
