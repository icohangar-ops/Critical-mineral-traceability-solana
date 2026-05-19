# Compliance Rules Engine Specification

## Purpose

The Compliance Rules Engine (CRE) is an off-chain service that computes domestic content percentages and compliance status for any asset in the CritMinChain system. It does so by traversing the full upstream supply chain graph stored on Solana and applying configurable, versioned policy rules. After computation, the CRE writes a signed `AttestationRecord` on-chain via the `compliance_attestation` Solana program and persists a complete audit trace to PostgreSQL.

The CRE is the sole authorized holder of the `AttestationService` keypair recognized by `compliance_attestation`. All attestation records are therefore traceable to this service and verifiable against its published public key.

---

## Supported Policy Frameworks

### 1. IRA Section 45X — Advanced Manufacturing Production Credit

Defined in 26 U.S.C. § 45X. Provides a per-unit production credit for domestically manufactured components including battery cells, modules, and critical minerals.

**Scope:** Critical minerals must be extracted or processed in the United States or a country with a qualifying free trade agreement (FTA) with the United States.

**Applicable minerals:** Lithium, cobalt, nickel, graphite, manganese, and all other minerals on the DOE Critical Materials List (updated annually).

**Domestic content thresholds (value-based, calendar year schedule):**

| Year | Minimum Domestic + FTA % |
|------|--------------------------|
| 2024 | 40% |
| 2025 | 50% |
| 2026 | 60% |
| 2027+ | 80% |

**CritMinChain policy ID convention:** `IRA-45X-{YYYY}-v{N}` (e.g., `IRA-45X-2026-v1`)

**FEOC exclusion:** Not explicitly mandated under 45X, but FEOC-sourced content reduces qualifying domestic percentage to zero for affected upstream nodes.

---

### 2. IRA Section 30D — Clean Vehicle Credit (Battery Component Requirements)

Defined in 26 U.S.C. § 30D, as amended by the Inflation Reduction Act (2022) and subsequent Treasury guidance.

**Two independent compliance tracks must both be satisfied:**

#### Track A: Battery Components
Battery components must be manufactured or assembled in North America (US, Canada, Mexico).

| Year | Minimum North American Component % |
|------|-------------------------------------|
| 2024 | 50% |
| 2025 | 60% |
| 2026 | 70% |
| 2027 | 80% |
| 2028 | 90% |
| 2029+ | 100% |

#### Track B: Critical Minerals
Critical minerals must be extracted or processed in the US or an FTA partner country, or recycled in North America.

| Year | Minimum Domestic/FTA Mineral % |
|------|--------------------------------|
| 2024 | 40% |
| 2025 | 50% |
| 2026 | 60% |
| 2027+ | 80% |

#### FEOC Exclusion Schedule
- **After December 31, 2024:** No battery components manufactured or assembled by a FEOC entity.
- **After December 31, 2025:** No critical minerals extracted, processed, or recycled by a FEOC entity.

Violation of either FEOC exclusion renders the vehicle ineligible for the credit regardless of content percentages.

**CritMinChain policy ID convention:** `IRA-30D-COMPONENTS-{YYYY}-v{N}` and `IRA-30D-MINERALS-{YYYY}-v{N}`

---

### 3. DoD Domestic Content Requirements

**Policy ID:** `DOD-DEFENSE-DOMESTIC-CONTENT-v1` (internal designation: `Defense-Enhanced-Domestic-Content-v1`)

Applies to battery systems procured for or used in defense applications. Requirements are stricter than IRA frameworks.

**Key requirements:**

| Requirement | Threshold |
|---|---|
| US-origin content (value) | ≥ 65% (2026 baseline; subject to revision) |
| Trusted ally content (value) | ≥ 85% combined domestic + allied |
| FEOC exclusion | Absolute; no tolerance or phase-in |
| Tier 1 supplier origin | Must be US-origin or designated "trusted ally" |
| CMMC compliance | All Tier 1 and Tier 2 supply chain entities must hold CMMC Level 2 or higher |

**CMMC gate:** The CRE checks `entity_registry` for `cmmc_level >= 2` on all Tier 1 and Tier 2 entities in the upstream graph. Any non-compliant entity results in `NON_COMPLIANT` status with reason `CMMC_FAILURE`, regardless of content percentages.

**Export-control gate:** The CRE queries an external export-control screening service (EAR/ITAR classification) for each entity and asset type combination. Non-compliant lots are flagged `EXPORT_BLOCKED` and cannot be assigned to defense applications.

**Trusted ally list:** Maintained by the DoD and mirrored in the CRE configuration. Currently includes: Australia, Canada, Japan, South Korea, United Kingdom, European Union member states, and other Five Eyes / QUAD partners. Updated via signed configuration push from the governance authority.

---

### 4. FEOC (Foreign Entity of Concern) Rules

Defined under Section 40207 of the Infrastructure Investment and Jobs Act (2021) and Section 30D IRA guidance. A "Foreign Entity of Concern" is any entity subject to the jurisdiction or direction of a covered foreign government (China, Russia, North Korea, Iran) or one in which a foreign government or FEOC entity holds ≥ 25% ownership or control.

**Entity-level screening:**

- The CRE maintains a FEOC designation list mirrored from official government sources.
- An entity is flagged FEOC if it appears directly on the list OR if any entity in its corporate ownership chain holds ≥ 25% ownership in it.
- Ownership tracing is applied recursively up to 5 levels deep (configurable). Beyond 5 levels, a `FEOC_UNCERTAINTY` flag is raised, triggering manual review.

**On-chain FEOC enforcement:**

- The current FEOC entity set is committed as a merkle tree root stored in each `PolicyAccount.feoc_merkle_root`.
- During attestation, the CRE submits merkle proofs for each evaluated entity to the `compliance_attestation` program.
- The merkle root is rotated weekly by the Oracle service (see Configuration) and a new governance-signed transaction updates the on-chain root.

**Cascade rule:** A FEOC flag on any upstream entity (at any depth in the supply chain graph) propagates to the target asset. The entire asset is marked non-compliant under any policy with FEOC exclusion requirements.

---

## Computation Flow

The CRE executes the following pipeline for each evaluation request. Each step is logged to the audit database before proceeding.

### Step 1: Graph Traversal

```
Given: target_asset_id (32 bytes), policy_id (32 bytes)

1. Load AssetAccount for target_asset_id from Solana RPC.
2. If AssetAccount.parent_assets is empty → leaf node; proceed to Step 2.
3. Otherwise, recursively load parent AssetAccounts and repeat.
4. Build a directed acyclic graph (DAG):
     nodes = { asset_id: AssetAccount }
     edges = { child_asset_id → parent_asset_id }
5. Detect and reject cycles (should be structurally impossible given on-chain constraints,
   but validated defensively).
6. Identify leaf nodes: AssetAccounts with empty parent_assets
   (raw extraction events — first point of entry into the chain).
7. For each node, load the corresponding EntityAccount from entity_registry.
```

**Implementation notes:**
- Traversal uses an iterative BFS queue to avoid stack overflow on deep graphs.
- Solana RPC calls are batched using `getMultipleAccounts` (max 100 accounts per call) to minimize latency.
- Graph depth is capped at a configurable `MAX_GRAPH_DEPTH` (default: 50 hops). Graphs exceeding this limit return `PENDING_REVIEW` pending manual inspection.
- Cycle detection uses a visited-set check before enqueuing each node.

---

### Step 2: Jurisdiction Classification

For each leaf asset node, the CRE classifies the producing entity:

```
For each leaf_asset in leaf_nodes:
    entity = EntityAccount[leaf_asset.owner_entity]

    // FEOC check (highest priority — short-circuits other classification)
    if entity.feoc_flag == true
        OR merkle_proof_verify(policy.feoc_merkle_root, entity.entity_id):
        classification = FEOC

    // Domestic check
    elif entity.domestic_flag == true
        AND leaf_asset.jurisdiction in policy.qualifying_jurisdictions:
        classification = DOMESTIC

    // Allied check
    elif entity.allied_flag == true
        AND leaf_asset.jurisdiction in allied_jurisdiction_list:
        classification = ALLIED

    // Default
    else:
        classification = NON_ALLIED
```

**Classification precedence:** `FEOC > DOMESTIC > ALLIED > NON_ALLIED`

A `FEOC_UNCERTAINTY` flag is set if ownership chain depth exceeded the recursion limit.

---

### Step 3: Content Calculation

All monetary values are in USD cents (u64) to avoid floating-point precision loss. Percentages are expressed as basis points (0–10000) in storage, resolved to floating-point only for display.

```
// Value-based domestic content
domestic_value  = SUM(leaf.value_usd_cents
                      WHERE classification(leaf) == DOMESTIC)
total_value     = SUM(leaf.value_usd_cents FOR ALL leaf nodes)
domestic_pct_value = (domestic_value * 10000) / total_value    // basis points

// Value-based allied content (domestic counts as allied for threshold purposes)
allied_value    = SUM(leaf.value_usd_cents
                      WHERE classification(leaf) IN {DOMESTIC, ALLIED})
allied_pct_value = (allied_value * 10000) / total_value

// Mass-based domestic content
domestic_mass   = SUM(leaf.mass_kg WHERE classification(leaf) == DOMESTIC)
total_mass      = SUM(leaf.mass_kg FOR ALL leaf nodes)
domestic_pct_mass = (domestic_mass * 10000) / total_mass

// Guard against zero-denominator (asset with no valued leaf nodes)
if total_value == 0: raise ComputationError("No leaf asset values available")
if total_mass  == 0: raise ComputationError("No leaf asset mass available")
```

**Intermediate results are stored in the audit record** at this step to ensure reproducibility.

---

### Step 4: Compliance Determination

```
// FEOC violation check (any FEOC entity in upstream graph → immediate non-compliance)
feoc_entities = [entity for entity in upstream_entities
                 WHERE entity.classification == FEOC]

if len(feoc_entities) > 0:
    compliance_status = NON_COMPLIANT
    feoc_violation    = true

// CMMC check (DoD policy only)
elif policy.requires_cmmc:
    tier1_tier2_entities = get_tier_entities(graph, max_depth=2)
    if any(entity.cmmc_level < 2 for entity in tier1_tier2_entities):
        compliance_status = NON_COMPLIANT
        failure_reason    = CMMC_FAILURE

// Content threshold check
elif (domestic_pct_value >= policy.min_domestic_pct_value
      AND domestic_pct_mass >= policy.min_domestic_pct_mass):
    compliance_status = COMPLIANT

// Manual review edge cases
elif requires_manual_review(graph):
    // Triggered by: FEOC_UNCERTAINTY flag, graph depth exceeded,
    // missing entity credentials, data staleness > 30 days
    compliance_status = PENDING_REVIEW

// Default non-compliant
else:
    compliance_status = NON_COMPLIANT
    feoc_violation    = false
```

`requires_manual_review` conditions:

| Condition | Trigger |
|---|---|
| `FEOC_UNCERTAINTY` | Ownership chain tracing exceeded max depth |
| Stale credentials | Any upstream entity's `credential_hash` unchanged for > 365 days |
| Missing classification | Entity not classifiable (no `domestic_flag`, `allied_flag`, or FEOC match) |
| Graph depth exceeded | Upstream graph exceeds `MAX_GRAPH_DEPTH` |
| Value data missing | Any leaf asset has `value_usd_cents == 0` |

---

### Step 5: Attestation

```
1. Collect all input data points:
     - leaf asset values, mass, entity IDs, classifications
     - policy parameters (thresholds, qualifying jurisdictions, feoc_merkle_root)
     - computed intermediates (domestic_value, allied_value, etc.)
     - engine version, timestamp

2. Build merkle tree over serialized input data points (SHA-256 leaf hashing,
   sorted-pair internal nodes for deterministic root).

3. Sign attestation payload:
     payload = {
         asset_id, policy_id, compliance_status, feoc_violation,
         domestic_pct_value, domestic_pct_mass, allied_pct_value,
         merkle_root, engine_version, evaluated_at
     }
     signature = ed25519_sign(ATTESTER_PRIVATE_KEY, sha256(payload))

4. Submit on-chain:
     call compliance_attestation::attest_compliance(
         asset_id, policy_id,
         domestic_pct_value, domestic_pct_mass, allied_pct_value,
         compliance_status, merkle_root
     )
     → record solana_tx_signature

5. Persist to PostgreSQL:
     INSERT INTO attestation_audit_log (
         asset_id, policy_id, compliance_status, feoc_violation,
         domestic_pct_value, domestic_pct_mass, allied_pct_value,
         merkle_root, upstream_graph_json, intermediate_calculations_json,
         engine_version, solana_tx_signature, evaluated_at
     )
```

The full upstream graph JSON and intermediate calculations are stored in PostgreSQL (not on-chain) to bound on-chain storage costs while maintaining a complete, auditable computation record.

---

## API Endpoints

All endpoints require a valid API key in the `Authorization: Bearer <token>` header. The CRE API is an authenticated service; only registered platform participants may call it.

### `POST /api/v1/compliance/evaluate`

Triggers a full compliance evaluation for a single asset under a specific policy. If a fresh attestation already exists on-chain (within the staleness window), returns the cached result without recomputation.

**Request:**

```json
{
  "asset_id": "a3f4...32-hex-bytes",
  "policy_id": "b1c2...32-hex-bytes",
  "force_recompute": false
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `asset_id` | `string` | Yes | Hex-encoded 32-byte asset ID |
| `policy_id` | `string` | Yes | Hex-encoded 32-byte policy ID |
| `force_recompute` | `bool` | No | If `true`, bypasses staleness cache and recomputes; triggers revocation + new attestation if result differs |

**Response `200 OK`:**

```json
{
  "asset_id": "a3f4...",
  "policy_id": "b1c2...",
  "policy_name": "US-Domestic-Content-2026-v1",
  "domestic_pct_value": 7250,
  "domestic_pct_mass": 6800,
  "allied_pct_value": 8500,
  "compliance_status": "COMPLIANT",
  "feoc_violation": false,
  "merkle_root": "d9e0...",
  "attestation_tx": "5xKJ...solana-tx-signature",
  "upstream_summary": {
    "total_entities": 12,
    "domestic_entities": 8,
    "allied_entities": 2,
    "non_allied_entities": 2,
    "feoc_entities": 0,
    "graph_depth": 6,
    "leaf_nodes": 5
  },
  "evaluated_at": "2026-03-28T12:00:00Z",
  "cached": false
}
```

**Error responses:**

| HTTP Code | Error Code | Description |
|---|---|---|
| 400 | `INVALID_ASSET_ID` | Malformed hex or wrong length |
| 404 | `ASSET_NOT_FOUND` | No `AssetAccount` found on-chain |
| 404 | `POLICY_NOT_FOUND` | No `PolicyAccount` found on-chain |
| 409 | `POLICY_EXPIRED` | Policy outside effective/expiry window |
| 422 | `COMPUTATION_ERROR` | Graph traversal or calculation failed |
| 503 | `RPC_UNAVAILABLE` | Solana RPC node unreachable |

---

### `GET /api/v1/compliance/attestation/{asset_id}/{policy_id}`

Returns the stored `AttestationRecord` for a given asset/policy pair, including on-chain data and the full PostgreSQL audit trace.

**Path parameters:**
- `asset_id`: Hex-encoded 32-byte asset ID
- `policy_id`: Hex-encoded 32-byte policy ID

**Response `200 OK`:**

```json
{
  "asset_id": "...",
  "policy_id": "...",
  "attester": "Solana-pubkey-base58",
  "compliance_status": "COMPLIANT",
  "feoc_violation": false,
  "domestic_pct_value": 7250,
  "domestic_pct_mass": 6800,
  "allied_pct_value": 8500,
  "merkle_root": "...",
  "revoked": false,
  "attested_at": "2026-03-28T12:00:00Z",
  "attestation_tx": "...",
  "audit_log_id": "uuid"
}
```

---

### `GET /api/v1/compliance/trace/{asset_id}`

Returns the full upstream provenance graph for an asset with jurisdiction classification applied. Useful for audit and debugging.

**Query parameters:**
- `policy_id` (optional): If provided, applies classification according to this policy's qualifying jurisdictions and FEOC merkle root. Defaults to the most recently effective policy.
- `max_depth` (optional, int): Override traversal depth limit for this request (max: 100).

**Response `200 OK`:**

```json
{
  "asset_id": "...",
  "graph": {
    "nodes": [
      {
        "asset_id": "...",
        "asset_type": "RawOre",
        "mass_kg": 5000,
        "value_usd_cents": 150000,
        "entity_id": "...",
        "entity_type": "Miner",
        "jurisdiction": "US",
        "classification": "DOMESTIC",
        "depth": 3
      }
    ],
    "edges": [
      { "from": "child_asset_id", "to": "parent_asset_id" }
    ]
  },
  "summary": {
    "total_nodes": 18,
    "leaf_nodes": 5,
    "max_depth": 6
  },
  "generated_at": "2026-03-28T12:05:00Z"
}
```

---

### `POST /api/v1/compliance/batch-evaluate`

Evaluates multiple assets against a single policy in a single request. Computations run in parallel (up to `MAX_BATCH_CONCURRENCY`, default 10). Each asset evaluation is independent; a failure for one asset does not abort the batch.

**Request:**

```json
{
  "asset_ids": [
    "a3f4...",
    "b5c6...",
    "c7d8..."
  ],
  "policy_id": "b1c2...",
  "force_recompute": false
}
```

**Constraints:**
- Maximum 100 asset IDs per request.
- All assets evaluated against the same `policy_id`.

**Response `200 OK`:**

```json
{
  "policy_id": "b1c2...",
  "results": [
    {
      "asset_id": "a3f4...",
      "compliance_status": "COMPLIANT",
      "domestic_pct_value": 7250,
      "error": null
    },
    {
      "asset_id": "b5c6...",
      "compliance_status": null,
      "domestic_pct_value": null,
      "error": "ASSET_NOT_FOUND"
    }
  ],
  "summary": {
    "total": 3,
    "compliant": 1,
    "non_compliant": 1,
    "pending_review": 0,
    "errored": 1
  },
  "evaluated_at": "2026-03-28T12:05:00Z"
}
```

---

## Configuration

### Policy Rules

Policy threshold schedules are stored as versioned JSON configuration files. The CRE loads the active configuration at service start and on SIGHUP. Configuration changes require a governance authority signature before taking effect.

**Example policy config fragment:**

```json
{
  "policy_id": "IRA-30D-MINERALS-2026-v1",
  "framework": "IRA_30D_MINERALS",
  "thresholds": {
    "2024": { "min_domestic_pct_value": 4000, "min_domestic_pct_mass": 4000 },
    "2025": { "min_domestic_pct_value": 5000, "min_domestic_pct_mass": 5000 },
    "2026": { "min_domestic_pct_value": 6000, "min_domestic_pct_mass": 6000 },
    "2027": { "min_domestic_pct_value": 8000, "min_domestic_pct_mass": 8000 }
  },
  "feoc_exclusion": true,
  "qualifying_jurisdictions": ["US", "AU", "CA", "JP", "KR", "GB", "DE", "FR"],
  "requires_cmmc": false,
  "effective_date": "2024-01-01",
  "expiry_date": "2028-12-31"
}
```

At evaluation time, the CRE selects the threshold row matching the current calendar year.

### FEOC Entity Lists

- Updated **weekly** by the Oracle service from official government sources (BIS Entity List, OFAC SDN list, DOE FEOC guidance).
- Each update computes a new merkle root over the sorted FEOC entity ID set.
- The governance authority signs the new root and submits a `update_policy` transaction to update `PolicyAccount.feoc_merkle_root` on-chain.
- The CRE's local FEOC cache is refreshed from the Oracle service on startup and on a 6-hour polling interval.
- FEOC list version and root hash are logged in every attestation audit record for traceability.

### Jurisdiction Mappings

- Based on ISO 3166-1 alpha-2 country codes.
- FTA partner designations are loaded from a configuration file maintained by the governance authority.
- FTA partner list is reviewed quarterly. Changes require governance authority signature.
- "Trusted ally" list for DoD policy is a separate, more restrictive subset maintained in a dedicated config file.

### Threshold Schedules

- Each policy config contains a year-keyed threshold map (see example above).
- The CRE resolves the applicable threshold by matching `floor(current_year)` to the threshold map.
- If the current year exceeds the last key in the map, the last key's thresholds apply (ratchets, never relaxes).

---

## Audit Trail

Every CRE computation produces a permanent audit record in PostgreSQL. Records are append-only (no updates or deletes). The `attestation_audit_log` table schema:

```sql
CREATE TABLE attestation_audit_log (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id                    BYTEA NOT NULL,           -- 32 bytes
    policy_id                   BYTEA NOT NULL,           -- 32 bytes
    compliance_status           TEXT NOT NULL,
    feoc_violation              BOOLEAN NOT NULL,
    domestic_pct_value          INTEGER NOT NULL,         -- basis points
    domestic_pct_mass           INTEGER NOT NULL,
    allied_pct_value            INTEGER NOT NULL,
    merkle_root                 BYTEA NOT NULL,           -- 32 bytes
    upstream_graph_json         JSONB NOT NULL,           -- full DAG snapshot
    intermediate_calculations   JSONB NOT NULL,           -- step-by-step values
    input_data_snapshot         JSONB NOT NULL,           -- all leaf asset data
    engine_version              TEXT NOT NULL,            -- semver e.g. "1.4.2"
    solana_tx_signature         TEXT,                     -- null if dry-run
    evaluated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    evaluator_pubkey            TEXT NOT NULL,            -- attester keypair pubkey
    feoc_list_version           TEXT NOT NULL,            -- FEOC oracle version used
    policy_config_hash          BYTEA NOT NULL,           -- SHA-256 of policy config
    manual_review_flags         TEXT[],                   -- triggers for PENDING_REVIEW
    CONSTRAINT unique_asset_policy_timestamp
        UNIQUE (asset_id, policy_id, evaluated_at)
);

CREATE INDEX idx_aal_asset_id    ON attestation_audit_log (asset_id);
CREATE INDEX idx_aal_policy_id   ON attestation_audit_log (policy_id);
CREATE INDEX idx_aal_evaluated_at ON attestation_audit_log (evaluated_at DESC);
CREATE INDEX idx_aal_status      ON attestation_audit_log (compliance_status);
```

**Retention:** 7 years from record creation date, in compliance with IRS and DOE documentation requirements. Records are archived to cold storage (S3 Glacier or equivalent) after 2 years but remain queryable via the audit API.

**Immutability controls:**
- Row-level triggers prevent `UPDATE` and `DELETE` on `attestation_audit_log`.
- Periodic hash-chain validation job verifies record integrity by checking that each record's `merkle_root` is reproducible from its `input_data_snapshot`.
- Database user for the CRE application has `INSERT` privilege only on this table; `UPDATE`/`DELETE` are reserved for a separate, break-glass DBA role.

**Access:**
- Audit log records are accessible via `GET /api/v1/compliance/attestation/{asset_id}/{policy_id}` (individual record) and `GET /api/v1/audit/export` (bulk export for auditors, requires `Auditor` role).

---

## Infrastructure and Deployment

### Service Architecture

```
┌─────────────────────────────────┐
│        CRE API Service          │  ← REST API (FastAPI / Axum TBD)
│  POST /evaluate                 │
│  GET  /attestation              │
│  GET  /trace                    │
│  POST /batch-evaluate           │
└────────────┬────────────────────┘
             │
     ┌───────▼────────┐     ┌─────────────────────┐
     │  Graph Engine  │────▶│  Solana RPC Node(s)  │
     │  (Traversal +  │     │  (dedicated RPC,     │
     │   Classification)    │   not public)        │
     └───────┬────────┘     └─────────────────────┘
             │
     ┌───────▼────────┐     ┌─────────────────────┐
     │ Rules Engine   │────▶│  Policy Config Store │
     │ (Calculation + │     │  (versioned JSON,    │
     │  Determination)│     │   S3 / Git)          │
     └───────┬────────┘     └─────────────────────┘
             │
     ┌───────▼────────┐     ┌─────────────────────┐
     │  Attestation   │────▶│  compliance_         │
     │  Writer        │     │  attestation program │
     │                │     │  (Solana mainnet)    │
     └───────┬────────┘     └─────────────────────┘
             │
     ┌───────▼────────┐
     │  Audit Logger  │────▶  PostgreSQL
     └────────────────┘
```

### Scalability

- Graph traversal is the primary bottleneck; Solana RPC batch calls are used to minimize round-trips.
- Evaluation results are cached in Redis with a configurable TTL (default: 24 hours). Cache is invalidated on any on-chain state change affecting upstream assets (detected via event subscription).
- The batch-evaluate endpoint distributes work across a thread pool (Tokio async tasks if Rust, asyncio if Python).

### Availability

- The CRE is deployed as a stateless service (multiple replicas) behind a load balancer.
- The Solana attester keypair is stored in a hardware security module (HSM) or KMS; the service accesses it only for signing attestation transactions.
- Health check endpoint: `GET /health` returns `200 OK` with Solana RPC connectivity status and PostgreSQL connectivity status.
