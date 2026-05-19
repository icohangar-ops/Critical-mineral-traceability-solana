# API Reference

CritMinChain exposes a set of REST APIs for off-chain services that complement the on-chain Solana program. These services handle data indexing, compliance evaluation, provenance queries, and Helius-powered transaction parsing.

---

## Base URL

```
https://api.critminchain.io/v1
```

All requests and responses use `application/json` unless otherwise noted. HTTPS (TLS 1.3 minimum) is required for all endpoints.

---

## Authentication

### Bearer Token (JWT)
Used for service-to-service communication between internal microservices (VDIS, Compliance Engine, Oracle).

```http
Authorization: Bearer <jwt_token>
```

JWTs are signed with RS256. Tokens expire after 1 hour. Obtain tokens from the internal identity service at `POST /auth/token`.

### API Key
Used for OEM and partner integrations. Include the key in the `X-API-Key` header.

```http
X-API-Key: <api_key>
```

Partner API keys are provisioned through the operator portal and are scoped to specific entity IDs and resource types. All keys are logged and auditable.

### DoD CAC/PIV Certificate Authentication
Government endpoints under `/compliance/` and `/verify/` support mutual TLS (mTLS) with DoD CAC/PIV certificates. The client must present a valid certificate signed by the DoD PKI root CA. Certificate validation is performed at the load balancer (AWS ALB / Azure Application Gateway).

```http
# No additional headers needed; authentication is handled at the TLS layer.
# The extracted subject DN is forwarded in the X-Client-Cert-Subject header by the load balancer.
```

---

## Endpoints

---

### Assets

#### `POST /assets`
Create a new on-chain asset record. This endpoint submits a Solana transaction via the VDIS service to initialize an `AssetRecord` PDA.

**Auth:** Bearer token or API key

**Request Body:**
```json
{
  "asset_type": "LithiumCarbonate",
  "entity_id": "ent_7a3f9c2d",
  "origin_country": "US",
  "mass_kg": 1200.5,
  "batch_id": "BATCH-2026-0042",
  "metadata_uri": "ipfs://bafybeig...",
  "classifications": {
    "section232_covered": true,
    "dodcn_relevant": true,
    "itar_controlled": false
  }
}
```

**Response Body (`201 Created`):**
```json
{
  "asset_id": "asset_4b8e2f1a",
  "pda_address": "9xQf3...mK7",
  "tx_signature": "5J7Kv...wP2",
  "created_at": "2026-03-28T12:00:00Z",
  "status": "active"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `201` | Asset created successfully |
| `400` | Invalid request body or missing required fields |
| `401` | Missing or invalid authentication |
| `409` | Asset with this batch_id already exists for this entity |
| `422` | Entity not registered or not in good standing |
| `503` | Solana RPC unavailable |

**Example:**
```bash
curl -X POST https://api.critminchain.io/v1/assets \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_type": "LithiumCarbonate",
    "entity_id": "ent_7a3f9c2d",
    "origin_country": "US",
    "mass_kg": 1200.5,
    "batch_id": "BATCH-2026-0042",
    "metadata_uri": "ipfs://bafybeig...",
    "classifications": {
      "section232_covered": true,
      "dodcn_relevant": true,
      "itar_controlled": false
    }
  }'
```

---

#### `GET /assets/{asset_id}`
Retrieve full details for a single asset, including its current on-chain state and off-chain metadata.

**Auth:** Bearer token, API key, or public (read-only, rate-limited)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `asset_id` | string | Unique asset identifier |

**Response Body (`200 OK`):**
```json
{
  "asset_id": "asset_4b8e2f1a",
  "pda_address": "9xQf3...mK7",
  "asset_type": "LithiumCarbonate",
  "entity_id": "ent_7a3f9c2d",
  "entity_name": "Silver Peak Lithium Mine LLC",
  "origin_country": "US",
  "mass_kg": 1200.5,
  "batch_id": "BATCH-2026-0042",
  "status": "active",
  "classifications": {
    "section232_covered": true,
    "dodcn_relevant": true,
    "itar_controlled": false
  },
  "created_at": "2026-03-28T12:00:00Z",
  "updated_at": "2026-03-28T14:22:00Z",
  "tx_signature": "5J7Kv...wP2"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |
| `401` | Authentication required for this resource classification |
| `404` | Asset not found |

**Example:**
```bash
curl https://api.critminchain.io/v1/assets/asset_4b8e2f1a \
  -H "X-API-Key: $API_KEY"
```

---

#### `GET /assets/{asset_id}/history`
Return the full provenance history for an asset: all events ordered chronologically from origin through current state.

**Auth:** Bearer token or API key

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `asset_id` | string | Unique asset identifier |

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Max events to return (default: 50, max: 500) |
| `offset` | integer | Pagination offset |
| `event_type` | string | Filter by event type (`transfer`, `transform`, `attestation`) |

**Response Body (`200 OK`):**
```json
{
  "asset_id": "asset_4b8e2f1a",
  "total_events": 7,
  "events": [
    {
      "event_id": "evt_001",
      "event_type": "creation",
      "timestamp": "2026-01-10T08:00:00Z",
      "actor_entity_id": "ent_7a3f9c2d",
      "tx_signature": "3Hk9...pQ1",
      "details": {
        "origin_country": "US",
        "mass_kg": 1200.5,
        "batch_id": "BATCH-2026-0042"
      }
    },
    {
      "event_id": "evt_002",
      "event_type": "transfer",
      "timestamp": "2026-02-14T10:30:00Z",
      "actor_entity_id": "ent_2c1a9f3b",
      "tx_signature": "7Wm2...nR4",
      "details": {
        "from_entity": "ent_7a3f9c2d",
        "to_entity": "ent_2c1a9f3b",
        "mass_transferred_kg": 1200.5
      }
    }
  ]
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |
| `401` | Missing or invalid authentication |
| `404` | Asset not found |

---

#### `GET /assets/{asset_id}/graph`
Return the upstream supply chain graph for an asset. Nodes represent assets and entities; edges represent transfers and transformations. Useful for rendering provenance visualizations.

**Auth:** Bearer token or API key

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `asset_id` | string | Unique asset identifier |

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `depth` | integer | Upstream depth to traverse (default: 5, max: 20) |

**Response Body (`200 OK`):**
```json
{
  "root_asset_id": "asset_4b8e2f1a",
  "nodes": [
    {
      "id": "asset_4b8e2f1a",
      "type": "asset",
      "label": "LithiumCarbonate BATCH-2026-0042",
      "data": { "asset_type": "LithiumCarbonate", "origin_country": "US" }
    },
    {
      "id": "ent_7a3f9c2d",
      "type": "entity",
      "label": "Silver Peak Lithium Mine LLC",
      "data": { "entity_type": "Mine", "jurisdiction": "US" }
    }
  ],
  "edges": [
    {
      "from": "ent_7a3f9c2d",
      "to": "asset_4b8e2f1a",
      "type": "created",
      "tx_signature": "5J7Kv...wP2"
    }
  ]
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |
| `401` | Missing or invalid authentication |
| `404` | Asset not found |

---

#### `POST /assets/transform`
Record a transformation event — e.g., ore refined into precursor material, precursor processed into battery-grade lithium. Links input asset(s) to output asset(s) with a recorded transformation ratio.

**Auth:** Bearer token or API key (entity must be the custodian of input assets)

**Request Body:**
```json
{
  "transformer_entity_id": "ent_5d2b7e9c",
  "transformation_type": "Refining",
  "input_assets": [
    { "asset_id": "asset_4b8e2f1a", "mass_consumed_kg": 1200.5 }
  ],
  "output_assets": [
    {
      "asset_type": "BatteryGradeLithium",
      "mass_kg": 980.2,
      "batch_id": "REFBATCH-2026-0012",
      "metadata_uri": "ipfs://bafybei..."
    }
  ],
  "facility_id": "fac_usa_nv_001",
  "process_date": "2026-03-01T00:00:00Z"
}
```

**Response Body (`201 Created`):**
```json
{
  "transform_event_id": "evt_tx_003",
  "input_asset_ids": ["asset_4b8e2f1a"],
  "output_asset_ids": ["asset_8c3e1d2f"],
  "tx_signature": "2Lp4...kM9",
  "created_at": "2026-03-28T15:00:00Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `201` | Transformation recorded |
| `400` | Invalid transformation parameters |
| `401` | Missing or invalid authentication |
| `403` | Requesting entity is not the custodian of input assets |
| `404` | One or more input assets not found |
| `409` | Input asset already consumed in a prior transformation |

---

#### `POST /assets/transfer`
Record the transfer of custody of an asset from one registered entity to another.

**Auth:** Bearer token or API key (entity must be current custodian)

**Request Body:**
```json
{
  "asset_id": "asset_8c3e1d2f",
  "from_entity_id": "ent_5d2b7e9c",
  "to_entity_id": "ent_9f4a1c6b",
  "mass_kg": 980.2,
  "shipment_reference": "SHIP-2026-0055",
  "transfer_date": "2026-03-10T00:00:00Z"
}
```

**Response Body (`201 Created`):**
```json
{
  "transfer_event_id": "evt_tr_004",
  "asset_id": "asset_8c3e1d2f",
  "from_entity_id": "ent_5d2b7e9c",
  "to_entity_id": "ent_9f4a1c6b",
  "tx_signature": "8Nx6...hT1",
  "created_at": "2026-03-28T16:00:00Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `201` | Transfer recorded |
| `400` | Invalid request body |
| `401` | Missing or invalid authentication |
| `403` | Requesting entity is not the current custodian |
| `404` | Asset or target entity not found |
| `422` | Target entity not in good standing or not registered |

---

#### `GET /assets`
Search and filter assets. Supports pagination.

**Auth:** Bearer token or API key

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `entity_id` | string | Filter by owning/custodian entity |
| `asset_type` | string | Filter by asset type (e.g., `LithiumCarbonate`) |
| `status` | string | Filter by status (`active`, `consumed`, `transferred`) |
| `origin_country` | string | ISO 3166-1 alpha-2 country code |
| `from` | ISO 8601 | Created after this timestamp |
| `to` | ISO 8601 | Created before this timestamp |
| `limit` | integer | Max results (default: 20, max: 100) |
| `offset` | integer | Pagination offset |

**Response Body (`200 OK`):**
```json
{
  "total": 42,
  "limit": 20,
  "offset": 0,
  "assets": [
    {
      "asset_id": "asset_4b8e2f1a",
      "asset_type": "LithiumCarbonate",
      "entity_id": "ent_7a3f9c2d",
      "origin_country": "US",
      "status": "active",
      "created_at": "2026-01-10T08:00:00Z"
    }
  ]
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Invalid query parameters |
| `401` | Missing or invalid authentication |

---

### Entities

#### `POST /entities`
Register a new supply chain entity (mine, refiner, processor, OEM, government auditor).

**Auth:** Bearer token (operator-level) or DoD CAC/PIV for government entities

**Request Body:**
```json
{
  "entity_name": "Silver Peak Lithium Mine LLC",
  "entity_type": "Mine",
  "jurisdiction": "US",
  "registration_number": "NV-MINE-2024-0012",
  "signing_public_key": "7dKf2...mN8",
  "credentials": {
    "iso14001_certified": true,
    "dodd_frank_compliant": true,
    "ofac_screened": true,
    "responsible_minerals_certified": true
  },
  "contact": {
    "name": "Jane Smith",
    "email": "jane.smith@silverpeaklithium.com",
    "phone": "+1-775-555-0100"
  }
}
```

**Response Body (`201 Created`):**
```json
{
  "entity_id": "ent_7a3f9c2d",
  "pda_address": "3Hk9...pQ1",
  "tx_signature": "6Rn3...wZ7",
  "created_at": "2026-03-28T12:00:00Z",
  "status": "active"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `201` | Entity registered |
| `400` | Invalid request body |
| `401` | Missing or invalid authentication |
| `409` | Entity with this registration number already exists |
| `422` | Signing public key is invalid or already in use |

---

#### `GET /entities/{entity_id}`
Retrieve entity details including credentials and on-chain registration status.

**Auth:** Bearer token, API key, or public (limited fields)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `entity_id` | string | Unique entity identifier |

**Response Body (`200 OK`):**
```json
{
  "entity_id": "ent_7a3f9c2d",
  "pda_address": "3Hk9...pQ1",
  "entity_name": "Silver Peak Lithium Mine LLC",
  "entity_type": "Mine",
  "jurisdiction": "US",
  "registration_number": "NV-MINE-2024-0012",
  "status": "active",
  "credentials": {
    "iso14001_certified": true,
    "dodd_frank_compliant": true,
    "ofac_screened": true,
    "responsible_minerals_certified": true,
    "last_verified_at": "2026-01-15T00:00:00Z"
  },
  "asset_count": 14,
  "created_at": "2024-06-01T00:00:00Z",
  "updated_at": "2026-01-15T00:00:00Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |
| `404` | Entity not found |

---

#### `PATCH /entities/{entity_id}/credentials`
Update credential flags for a registered entity. Typically invoked by an oracle or auditor after credential verification.

**Auth:** Bearer token (auditor role) or DoD CAC/PIV

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `entity_id` | string | Unique entity identifier |

**Request Body:**
```json
{
  "credentials": {
    "iso14001_certified": true,
    "dodd_frank_compliant": true,
    "ofac_screened": true,
    "responsible_minerals_certified": false
  },
  "reason": "Annual re-certification: RMI certification lapsed",
  "effective_date": "2026-03-28T00:00:00Z"
}
```

**Response Body (`200 OK`):**
```json
{
  "entity_id": "ent_7a3f9c2d",
  "credentials_updated": true,
  "tx_signature": "9Yb1...cL5",
  "updated_at": "2026-03-28T12:00:00Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Credentials updated |
| `400` | Invalid credential fields |
| `401` | Missing or invalid authentication |
| `403` | Caller does not have auditor role |
| `404` | Entity not found |

---

#### `GET /entities`
Search and filter registered entities.

**Auth:** Bearer token or API key

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `jurisdiction` | string | ISO 3166-1 alpha-2 country code (e.g., `US`) |
| `entity_type` | string | `Mine`, `Refiner`, `Processor`, `OEM`, `Auditor` |
| `status` | string | `active`, `suspended`, `revoked` |
| `credential` | string | Filter by credential flag (e.g., `iso14001_certified`) |
| `limit` | integer | Max results (default: 20, max: 100) |
| `offset` | integer | Pagination offset |

**Response Body (`200 OK`):**
```json
{
  "total": 8,
  "limit": 20,
  "offset": 0,
  "entities": [
    {
      "entity_id": "ent_7a3f9c2d",
      "entity_name": "Silver Peak Lithium Mine LLC",
      "entity_type": "Mine",
      "jurisdiction": "US",
      "status": "active"
    }
  ]
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Invalid query parameters |
| `401` | Missing or invalid authentication |

---

### Compliance

#### `POST /compliance/evaluate`
Evaluate a single asset against a specified compliance policy. The Compliance Engine traverses the upstream supply chain graph, checks each node against the policy rules, and returns a pass/fail result with per-node annotations.

**Auth:** Bearer token, API key, or DoD CAC/PIV

**Request Body:**
```json
{
  "asset_id": "asset_8c3e1d2f",
  "policy_id": "DOD_NDAA_2026_SEC232",
  "evaluation_depth": 10,
  "include_annotations": true
}
```

**Response Body (`200 OK`):**
```json
{
  "evaluation_id": "eval_cc2a9f1b",
  "asset_id": "asset_8c3e1d2f",
  "policy_id": "DOD_NDAA_2026_SEC232",
  "result": "PASS",
  "score": 1.0,
  "evaluated_at": "2026-03-28T12:05:00Z",
  "attestation_hash": "sha256:3e4f...",
  "nodes_evaluated": 6,
  "annotations": [
    {
      "node_id": "ent_7a3f9c2d",
      "node_type": "entity",
      "rule": "no_foe_beneficial_ownership",
      "result": "PASS",
      "detail": "No FOE beneficial ownership detected"
    }
  ]
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Evaluation complete |
| `400` | Invalid request body |
| `401` | Missing or invalid authentication |
| `404` | Asset or policy not found |
| `422` | Incomplete supply chain data; evaluation cannot proceed |

---

#### `GET /compliance/attestation/{asset_id}/{policy_id}`
Retrieve the most recent attestation record for an asset/policy pair, including the on-chain attestation PDA and signature.

**Auth:** Bearer token, API key, or DoD CAC/PIV

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `asset_id` | string | Unique asset identifier |
| `policy_id` | string | Policy profile identifier |

**Response Body (`200 OK`):**
```json
{
  "attestation_id": "att_9e2c4f7a",
  "asset_id": "asset_8c3e1d2f",
  "policy_id": "DOD_NDAA_2026_SEC232",
  "result": "PASS",
  "attestation_hash": "sha256:3e4f...",
  "pda_address": "Bm3K...xP9",
  "tx_signature": "1Vf7...qR2",
  "attested_at": "2026-03-28T12:05:00Z",
  "policy_version": "2026.1",
  "valid_until": "2027-03-28T12:05:00Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |
| `401` | Missing or invalid authentication |
| `404` | No attestation record found for this asset/policy pair |

---

#### `GET /compliance/trace/{asset_id}`
Return a full upstream trace of an asset with compliance classifications at each node. Used for audit reporting and supply chain due diligence.

**Auth:** Bearer token, API key, or DoD CAC/PIV

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `asset_id` | string | Unique asset identifier |

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `policy_id` | string | Optional: overlay policy classifications on trace results |
| `depth` | integer | Upstream depth (default: 10, max: 20) |

**Response Body (`200 OK`):**
```json
{
  "asset_id": "asset_8c3e1d2f",
  "trace_depth": 3,
  "policy_id": "DOD_NDAA_2026_SEC232",
  "overall_result": "PASS",
  "trace": [
    {
      "level": 0,
      "asset_id": "asset_8c3e1d2f",
      "asset_type": "BatteryGradeLithium",
      "custodian_entity_id": "ent_9f4a1c6b",
      "classification": "PASS",
      "flags": []
    },
    {
      "level": 1,
      "asset_id": "asset_4b8e2f1a",
      "asset_type": "LithiumCarbonate",
      "custodian_entity_id": "ent_5d2b7e9c",
      "classification": "PASS",
      "flags": []
    },
    {
      "level": 2,
      "asset_id": "asset_0a1b2c3d",
      "asset_type": "LithiumOre",
      "custodian_entity_id": "ent_7a3f9c2d",
      "classification": "PASS",
      "flags": []
    }
  ]
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |
| `401` | Missing or invalid authentication |
| `404` | Asset not found |

---

#### `POST /compliance/batch-evaluate`
Evaluate multiple assets against one or more policies in a single request. Results are processed asynchronously; a job ID is returned for polling.

**Auth:** Bearer token or DoD CAC/PIV

**Request Body:**
```json
{
  "evaluations": [
    { "asset_id": "asset_8c3e1d2f", "policy_id": "DOD_NDAA_2026_SEC232" },
    { "asset_id": "asset_1d2e3f4a", "policy_id": "DOD_NDAA_2026_SEC232" },
    { "asset_id": "asset_5b6c7d8e", "policy_id": "IRA_2022_DOMESTIC_CONTENT" }
  ],
  "callback_url": "https://your-service.example.com/webhooks/compliance"
}
```

**Response Body (`202 Accepted`):**
```json
{
  "job_id": "job_b3f1a9c2",
  "status": "queued",
  "total_evaluations": 3,
  "submitted_at": "2026-03-28T12:00:00Z",
  "estimated_completion_seconds": 15
}
```

Poll job status at `GET /compliance/batch-evaluate/{job_id}`.

**Status Codes:**
| Code | Description |
|------|-------------|
| `202` | Batch job accepted |
| `400` | Invalid request body |
| `401` | Missing or invalid authentication |
| `422` | One or more asset or policy IDs are invalid |

---

#### `GET /compliance/policies`
List all available compliance policy profiles.

**Auth:** Bearer token, API key, or public (read-only)

**Response Body (`200 OK`):**
```json
{
  "policies": [
    {
      "policy_id": "DOD_NDAA_2026_SEC232",
      "name": "DoD NDAA 2026 Section 232 — Critical Minerals",
      "version": "2026.1",
      "jurisdiction": "US",
      "asset_types": ["LithiumCarbonate", "BatteryGradeLithium", "Cobalt", "Nickel"],
      "effective_date": "2026-01-01T00:00:00Z"
    },
    {
      "policy_id": "IRA_2022_DOMESTIC_CONTENT",
      "name": "Inflation Reduction Act — Domestic Content Requirements",
      "version": "2024.3",
      "jurisdiction": "US",
      "asset_types": ["BatteryCell", "BatteryModule", "BatteryPack"],
      "effective_date": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |

---

#### `GET /compliance/policies/{policy_id}`
Get full details for a specific compliance policy, including rule definitions.

**Auth:** Bearer token or API key

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `policy_id` | string | Policy profile identifier |

**Response Body (`200 OK`):**
```json
{
  "policy_id": "DOD_NDAA_2026_SEC232",
  "name": "DoD NDAA 2026 Section 232 — Critical Minerals",
  "version": "2026.1",
  "jurisdiction": "US",
  "description": "Prohibits DoD procurement of critical minerals sourced from Foreign Entities of Concern (FEOCs) as defined in 10 U.S.C. § 4872.",
  "rules": [
    {
      "rule_id": "no_foe_beneficial_ownership",
      "description": "No entity in the supply chain may have >25% beneficial ownership by a FEOC",
      "applies_to": "entity",
      "severity": "FAIL"
    },
    {
      "rule_id": "origin_country_allowed",
      "description": "Mineral origin must be from a US FTA partner or domestic source",
      "applies_to": "asset",
      "severity": "FAIL"
    }
  ],
  "effective_date": "2026-01-01T00:00:00Z",
  "last_updated": "2026-02-15T00:00:00Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |
| `404` | Policy not found |

---

### Events

#### `GET /events`
Query supply chain events across assets and entities with time-range filtering.

**Auth:** Bearer token or API key

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `asset_id` | string | Filter by asset |
| `entity_id` | string | Filter by actor entity |
| `event_type` | string | `creation`, `transfer`, `transform`, `attestation`, `credential_update` |
| `from` | ISO 8601 | Start of time range |
| `to` | ISO 8601 | End of time range |
| `limit` | integer | Max results (default: 50, max: 500) |
| `offset` | integer | Pagination offset |

**Response Body (`200 OK`):**
```json
{
  "total": 23,
  "limit": 50,
  "offset": 0,
  "events": [
    {
      "event_id": "evt_002",
      "event_type": "transfer",
      "asset_id": "asset_4b8e2f1a",
      "actor_entity_id": "ent_5d2b7e9c",
      "timestamp": "2026-02-14T10:30:00Z",
      "tx_signature": "7Wm2...nR4"
    }
  ]
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Invalid query parameters |
| `401` | Missing or invalid authentication |

---

#### `GET /events/{event_id}`
Get full details for a specific supply chain event, including raw transaction data.

**Auth:** Bearer token or API key

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `event_id` | string | Unique event identifier |

**Response Body (`200 OK`):**
```json
{
  "event_id": "evt_002",
  "event_type": "transfer",
  "asset_id": "asset_4b8e2f1a",
  "actor_entity_id": "ent_5d2b7e9c",
  "timestamp": "2026-02-14T10:30:00Z",
  "tx_signature": "7Wm2...nR4",
  "slot": 289453012,
  "details": {
    "from_entity": "ent_7a3f9c2d",
    "to_entity": "ent_5d2b7e9c",
    "mass_transferred_kg": 1200.5,
    "shipment_reference": "SHIP-2026-0022"
  },
  "on_chain_data": {
    "program_id": "CritM...1111",
    "instruction": "transfer_asset",
    "accounts": ["9xQf3...mK7", "3Hk9...pQ1"]
  }
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |
| `401` | Missing or invalid authentication |
| `404` | Event not found |

---

### Verification

#### `GET /verify/{asset_id}/{policy_id}`
Public verification endpoint — no authentication required. Returns a compact compliance summary for use in procurement workflows, QR code lookups, and third-party integrations.

**Auth:** None

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `asset_id` | string | Unique asset identifier |
| `policy_id` | string | Policy profile identifier |

**Response Body (`200 OK`):**
```json
{
  "asset_id": "asset_8c3e1d2f",
  "policy_id": "DOD_NDAA_2026_SEC232",
  "compliant": true,
  "attestation_hash": "sha256:3e4f...",
  "manufacturer": "Silver Peak Lithium Mine LLC",
  "origin_country": "US",
  "production_date": "2026-03-01",
  "policy_version": "2026.1",
  "attested_at": "2026-03-28T12:05:00Z",
  "valid_until": "2027-03-28T12:05:00Z",
  "verification_url": "https://api.critminchain.io/v1/verify/asset_8c3e1d2f/DOD_NDAA_2026_SEC232"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Verification result returned |
| `404` | Asset not found or no attestation exists for this policy |

**Example:**
```bash
curl https://api.critminchain.io/v1/verify/asset_8c3e1d2f/DOD_NDAA_2026_SEC232
```

---

### Solana Integration

#### `GET /solana/status`
Return the current Solana cluster status via the configured Helius RPC node, including slot, block height, and epoch information.

**Auth:** Bearer token or API key

**Response Body (`200 OK`):**
```json
{
  "cluster": "mainnet-beta",
  "rpc_provider": "helius",
  "slot": 289453088,
  "block_height": 268901234,
  "epoch": 672,
  "epoch_progress_pct": 34.2,
  "health": "ok",
  "queried_at": "2026-03-28T12:00:05Z"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |
| `503` | Helius RPC unreachable |

---

#### `GET /solana/tx/{signature}`
Parse and decode a Solana transaction using the Helius Enhanced Transactions API. Returns human-readable instruction data for CritMinChain program calls.

**Auth:** Bearer token or API key

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `signature` | string | Base58-encoded transaction signature |

**Response Body (`200 OK`):**
```json
{
  "signature": "5J7Kv...wP2",
  "slot": 289453012,
  "block_time": "2026-03-28T12:00:00Z",
  "fee_lamports": 5000,
  "status": "success",
  "program_id": "CritM...1111",
  "instruction": "create_asset",
  "decoded_data": {
    "asset_type": "LithiumCarbonate",
    "entity_id": "ent_7a3f9c2d",
    "batch_id": "BATCH-2026-0042"
  },
  "accounts": [
    { "pubkey": "9xQf3...mK7", "role": "asset_pda", "writable": true },
    { "pubkey": "3Hk9...pQ1", "role": "entity_pda", "writable": false }
  ],
  "helius_enrichment": {
    "type": "CRITMINCHAIN_CREATE_ASSET",
    "source": "CRITMINCHAIN"
  }
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |
| `401` | Missing or invalid authentication |
| `404` | Transaction not found |
| `503` | Helius RPC unreachable |

---

#### `GET /solana/address/{address}/history`
Return the transaction history for a Solana address (typically a program PDA or entity signing key) via the Helius Transaction History API.

**Auth:** Bearer token or API key

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | Base58-encoded Solana public key |

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Max transactions to return (default: 20, max: 100) |
| `before` | string | Return transactions before this signature (cursor) |
| `until` | string | Return transactions until this signature |

**Response Body (`200 OK`):**
```json
{
  "address": "9xQf3...mK7",
  "total_returned": 5,
  "transactions": [
    {
      "signature": "5J7Kv...wP2",
      "slot": 289453012,
      "block_time": "2026-03-28T12:00:00Z",
      "status": "success",
      "instruction": "create_asset",
      "fee_lamports": 5000
    }
  ]
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Invalid address format |
| `401` | Missing or invalid authentication |
| `503` | Helius RPC unreachable |

---

## Rate Limits

Rate limits apply per API key or JWT subject.

| Tier | Limit | Applies To |
|------|-------|------------|
| Standard | 100 requests/min | Default (unauthenticated or basic API key) |
| Partner | 1,000 requests/min | Credentialed OEM/partner API keys |
| Government | Unlimited | DoD CAC/PIV authenticated requests |

When a rate limit is exceeded, the API returns `429 Too Many Requests` with the following headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1743163200
Retry-After: 42
```

---

## Error Format

All errors follow a consistent JSON envelope:

```json
{
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset with the specified ID does not exist",
    "details": {}
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `ASSET_NOT_FOUND` | 404 | Asset with the given ID does not exist |
| `ENTITY_NOT_FOUND` | 404 | Entity with the given ID does not exist |
| `POLICY_NOT_FOUND` | 404 | Compliance policy not found |
| `EVENT_NOT_FOUND` | 404 | Event not found |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication credentials |
| `FORBIDDEN` | 403 | Valid credentials but insufficient permissions |
| `INVALID_REQUEST` | 400 | Malformed or missing request parameters |
| `VALIDATION_ERROR` | 422 | Request body fails business logic validation |
| `CONFLICT` | 409 | Resource already exists or state conflict |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `SOLANA_UNAVAILABLE` | 503 | Solana RPC or Helius endpoint is unreachable |
| `INCOMPLETE_PROVENANCE` | 422 | Asset provenance chain is incomplete for evaluation |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Pagination

List endpoints support cursor-based or offset-based pagination. Use `limit` and `offset` parameters. Responses include a `total` field indicating the full result count before pagination.

```json
{
  "total": 42,
  "limit": 20,
  "offset": 20,
  "items": [...]
}
```

---

## Versioning

The API is versioned via the URL path (`/v1`). Breaking changes will be released under `/v2` with a deprecation notice and minimum 90-day migration window for existing integrations.
