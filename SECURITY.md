# Security Model

This document describes the security architecture, threat model, key management practices, compliance posture, and incident response procedures for CritMinChain. It is intended for security engineers, compliance officers, DoD program managers, and external auditors.

---

## Threat Model

CritMinChain operates at the intersection of critical infrastructure, defense procurement, and distributed ledger technology. The following threat scenarios inform all security design decisions.

### Supply Chain Data Manipulation (False Provenance Claims)
**Threat:** A malicious actor submits fraudulent asset records claiming a Foreign Entity of Concern (FEOC)-sourced mineral is domestically produced.

**Mitigations:**
- All asset records are anchored to on-chain PDAs; retroactive modification is cryptographically impossible.
- Entity signing keys must be presented for every write operation; keys are registry-bound to verified entities.
- Oracle attestations for origin country and entity credentials are multi-sourced and merkle-verified before on-chain storage.
- Compliance Engine performs full upstream graph traversal — a single tampered node cannot pass without corresponding fraudulent credentials at every upstream hop.

### Unauthorized Entity Registration
**Threat:** An attacker registers a fake supply chain entity to launder FEOC-sourced minerals through an apparently legitimate chain.

**Mitigations:**
- Entity registration requires operator-level JWT or DoD CAC/PIV authentication.
- KYC/KYB verification is performed off-chain before the on-chain registration transaction is submitted.
- OFAC screening is a mandatory credential field; the Oracle re-checks OFAC status on a configurable interval.
- Entity signing keys are bound to the on-chain `EntityRecord` PDA and cannot be reused across registrations.

### Attestation Forgery
**Threat:** An attacker forges a compliance attestation to falsely claim an asset passes DoD NDAA procurement requirements.

**Mitigations:**
- Attestation hashes are written on-chain by the Compliance Engine's program-derived authority — no external party can submit an attestation without that authority.
- The public `/verify` endpoint returns the on-chain attestation hash alongside the result; any third party can verify the hash matches the on-chain PDA.
- Attestation PDAs store the policy version, evaluation timestamp, and evaluating authority key — tampering with any field invalidates the hash.

### Private Commercial Data Exposure
**Threat:** Commercially sensitive data (pricing, contract terms, customer identities) is exposed through on-chain storage or API enumeration.

**Mitigations:**
- RESTRICTED and CONFIDENTIAL data (see [Data Classification](#data-classification)) is never stored on-chain. Only SHA-256 hashed pointers are written to the ledger.
- Off-chain data storage is access-controlled by entity_id-scoped API credentials.
- Mass and value data for individual shipments are classified RESTRICTED; only aggregate/anonymized metrics are publicly accessible.
- API responses are filtered by the caller's credential scope; OEM API keys cannot access another OEM's asset details.

### Key Compromise
**Threat:** An entity's signing key or the Compliance Engine's authority key is compromised, allowing unauthorized writes or fraudulent attestations.

**Mitigations:**
- Entity signing keys for production participants are HSM-backed (see [Key Management](#key-management)).
- Governance keys are held in cold storage with geographic distribution.
- Key compromise response procedure defined in [Incident Response](#incident-response).
- All key operations are logged with actor, timestamp, and purpose in the immutable audit trail.

### Oracle Data Poisoning
**Threat:** The off-chain Oracle is compromised to inject false credential or origin data, corrupting compliance evaluations.

**Mitigations:**
- Oracle submissions are cryptographically signed; the on-chain program validates the Oracle authority key before accepting any credential update.
- Merkle root verification catches data inconsistencies between oracle submissions and stored state.
- Anomaly detection monitors for sudden credential changes (e.g., all entities becoming OFAC-cleared simultaneously).
- Multi-source oracle design: OFAC and credential data is cross-checked from at least two independent sources before submission.
- Automatic fallback to manual review if merkle root verification fails (see [Incident Response](#incident-response)).

---

## On-Chain Security

### Multi-Sig Governance

Program upgrade authority is controlled by a **3-of-5 multi-sig** implemented via [Squads Protocol](https://squads.so) on Solana.

| Key Holder | Role | Storage |
|------------|------|---------|
| Key 1 | Operator (CritMinChain LLC) | AWS CloudHSM |
| Key 2 | Operator (CritMinChain LLC) | Azure Managed HSM |
| Key 3 | Government / DoD Auditor | PIV-backed HSM, geographically isolated |
| Key 4 | Independent Security Auditor | Cold storage |
| Key 5 | Independent Security Auditor | Cold storage |

**Quorum rules:**
- Standard upgrades: 3-of-5 approval required
- **At least 1 government/auditor key (Keys 3–5) must be included in the quorum** for any production upgrade
- Emergency bypass (e.g., critical vulnerability): requires 4-of-5 approval

**Timelock:**
- A **48-hour delay** is enforced on all program upgrades via the Squads timelock module.
- During the timelock window, any governance key holder can veto a pending upgrade.
- Emergency bypass of the timelock requires a 4-of-5 vote; this action is permanently logged on-chain.

### PDA Security

All CritMinChain accounts (AssetRecord, EntityRecord, AttestationRecord, TransformEvent, TransferEvent) are Program-Derived Addresses (PDAs):

- **Deterministic derivation:** addresses are derived from fixed seeds (e.g., `["asset", entity_id_bytes, batch_id_bytes]`), ensuring they can be independently computed and verified by any party.
- **No owner-controllable addresses:** because PDAs are not on the ed25519 curve, they cannot be signed for externally, preventing external key pairs from claiming ownership.
- **Bump seed storage:** the canonical bump seed for each PDA is stored in the account's data field. This prevents "seed grinding" attacks where an attacker finds an alternative seed combination that produces the same address.
- **Account ownership validation:** every instruction validates that the passed account is owned by the CritMinChain program ID before any data access.

### Access Control

Every program instruction implements role-based guards:

| Instruction | Required Signer | Role Check |
|-------------|----------------|------------|
| `create_asset` | Entity signing key | Entity must be registered and `status == active` |
| `transfer_asset` | Custodian entity signing key | Must be current PDA custodian field |
| `transform_asset` | Transformer entity signing key | Must be registered refiner/processor |
| `register_entity` | Operator authority key | Must match `OPERATOR_PUBKEY` constant |
| `update_credentials` | Oracle authority key | Must match `ORACLE_PUBKEY` constant |
| `submit_attestation` | Compliance Engine key | Must match `COMPLIANCE_ENGINE_PUBKEY` constant |
| `upgrade_program` | Squads multi-sig PDA | 3-of-5 quorum with timelock |

**Compute budget constraints:** rate limiting at the on-chain layer is enforced implicitly by Solana's compute unit (CU) limits. Instructions that iterate over large account sets (e.g., batch evaluations) are split into paginated instructions to stay within the 1.4M CU budget per transaction.

---

## Off-Chain Security

### Key Management

#### Entity Signing Keys
- **Production:** HSM-backed via AWS CloudHSM or Azure Managed HSM. The private key never leaves the HSM boundary.
- **Signing operations** are performed via HSM SDK calls from the VDIS service; the raw private key is never serialized to disk or memory outside the HSM.
- Keys are rotated annually or immediately upon suspected compromise.
- Key metadata (creation date, rotation schedule, owner entity) is logged in the audit trail.

#### Service Keys (VDIS, Compliance Engine, Oracle)
- JWT signing keys: RS256 key pairs rotated every **90 days**.
- Rotation procedure: generate new key pair → deploy new public key to JWKS endpoint → run in parallel for 24 hours → retire old key.
- Stored in AWS Secrets Manager or Azure Key Vault; referenced by ARN/URI, never embedded in configuration files.

#### Governance Keys
- Cold storage: hardware security modules (Ledger Nano X or equivalent FIPS 140-2 Level 3 device).
- Geographic distribution: Key 3 stored at a facility separate from Keys 1–2; Keys 4–5 with independent auditors.
- Access requires dual-person integrity (two authorized individuals present for any signing operation).
- Annual key ceremony to verify key integrity and update emergency contact procedures.

### Data Classification

| Classification | Examples | Storage | Access |
|---------------|---------|---------|--------|
| **PUBLIC** | Compliance pass/fail flags, attestation hashes, entity names, policy versions | On-chain (plaintext) | Unrestricted |
| **RESTRICTED** | Mass/value per shipment, transformation ratios, shipment metadata, facility IDs | Off-chain database; SHA-256 hash on-chain | Entity-scoped API credentials |
| **CONFIDENTIAL** | Pricing, contract terms, customer identities, non-public financial data | Off-chain, encrypted at rest (AES-256) | Explicit allowlist per field |

Only hashed pointers (SHA-256 of canonical JSON) are stored on-chain for RESTRICTED and CONFIDENTIAL data. This allows on-chain verification of data integrity without exposing the underlying content.

Encryption at rest for CONFIDENTIAL data uses AES-256-GCM with keys managed by the cloud provider's KMS (AWS KMS or Azure Key Vault). Database-level encryption (RDS encryption / Azure Database for PostgreSQL transparent data encryption) is always enabled.

### API Security

All API endpoints conform to the following baseline:

| Control | Specification |
|---------|--------------|
| Transport | TLS 1.3 minimum; TLS 1.2 disabled in production |
| Certificate | EV certificate from a CA in the Mozilla trust store |
| JWT algorithm | RS256 (asymmetric); HS256 is not accepted |
| JWT expiry | 1 hour; refresh tokens valid for 24 hours |
| API key format | 32-byte cryptographically random value, stored as bcrypt hash server-side |
| Partner endpoint access | API key + IP allowlist (CIDR ranges registered during onboarding) |
| Government endpoint access | DoD CAC/PIV mTLS; certificate validated against DoD PKI root CA |
| CORS | Allowlist of known frontend origins only |
| Content-Type | Strict `application/json` validation; multipart and XML rejected |
| Rate limiting | Enforced at ALB/WAF layer (see [API Reference](./API-REFERENCE.md)) |

**OWASP Top 10 hardening:**
- A01 Broken Access Control: entity-scoped queries; no insecure direct object references
- A02 Cryptographic Failures: no sensitive data in URLs; all tokens in Authorization headers
- A03 Injection: parameterized queries throughout; no raw SQL string concatenation
- A04 Insecure Design: threat model reviewed before each major feature
- A05 Security Misconfiguration: infrastructure-as-code with automated compliance checks (Checkov/tfsec)
- A07 Auth Failures: account lockout, JWT rotation, no long-lived tokens
- A09 Logging: all auth events and data mutations logged with structured JSON

---

## Compliance Frameworks

### CMMC Level 2+ Requirements

CritMinChain is designed to support operators handling Controlled Unclassified Information (CUI) in defense supply chains. Level 2 aligns with NIST SP 800-171 Rev 2.

**Access Control (AC) family:**
- AC.1.001: Limit system access to authorized users — enforced via JWT/API key + entity scoping.
- AC.1.002: Limit system access to transaction types and functions authorized — role-based instruction guards on all write operations.
- AC.2.006: Use non-privileged accounts for non-privileged activities — service accounts use least-privilege IAM roles.

**Audit and Accountability (AU) family:**
- AU.2.041: Ensure user actions can be traced to individual users — all events logged with entity_id and JWT subject.
- AU.2.042: Create and retain system audit logs — 7-year retention policy (see [Audit Trail](#audit-trail)).
- AU.3.045: Review and update logged events — quarterly log review by security team.

**Incident Response (IR) family:**
- IR.2.092: Establish an operational incident-handling capability — see [Incident Response](#incident-response).
- IR.2.093: Track, document, and report incidents — PagerDuty + Jira incident tracking.
- IR.3.098: Test incident response capability — annual tabletop exercises.

**CUI Handling Procedures:**
- CONFIDENTIAL-classified data (as defined in [Data Classification](#data-classification)) is treated as CUI when processed for defense contracts.
- CUI is stored only in US-region AWS GovCloud or Azure Government environments.
- CUI access is limited to personnel with a need-to-know, enforced by IAM role boundaries.
- CUI marking is applied to API responses that contain CONFIDENTIAL-class fields.

### FedRAMP Considerations

For deployments supporting federal agency contracts, the following controls are in scope:

**Deployment boundary:**
- All compute, storage, and database services must reside in AWS GovCloud (us-gov-west-1 / us-gov-east-1) or Azure Government.
- No data egress to commercial cloud regions for CUI.

**Data residency:**
- All data at rest and in transit must remain within US borders.
- Helius dedicated node must be confirmed US-based for government workloads.

**Continuous monitoring:**
- AWS Security Hub (GovCloud) enabled with NIST 800-53 standard.
- GuardDuty threat detection enabled on all accounts.
- CloudTrail logging enabled with log integrity validation.
- Plan of Action and Milestones (POA&M) maintained and reviewed monthly.

**Authorization to Operate (ATO):**
- FedRAMP Moderate baseline is the target authorization level.
- System Security Plan (SSP) maintained in the GovCloud environment.
- Third-Party Assessment Organization (3PAO) assessment required before agency-facing production launch.

### SOC 2 Type II

CritMinChain targets SOC 2 Type II certification covering three Trust Service Criteria:

| Criteria | Scope |
|----------|-------|
| Security (CC6–CC9) | Access controls, change management, risk mitigation |
| Availability (A1) | System uptime, disaster recovery, capacity planning |
| Confidentiality (C1) | Data classification, encryption, access restrictions |

**Audit cycle:** Annual. The audit period covers 12 months of continuous operation.

**Evidence collection:** Automated evidence collection via Vanta or Drata, capturing:
- Access review logs
- Vulnerability scan results
- Penetration test reports
- Incident records
- Change management tickets

---

## Incident Response

### Severity Levels

| Severity | Label | Definition | Initial Response |
|----------|-------|------------|-----------------|
| P0 | Critical | Active exploitation, data breach, program compromise, service-wide outage | Immediate (24/7); page on-call lead + security team |
| P1 | High | Suspected key compromise, oracle poisoning, auth bypass, > 15 min downtime | 15-minute response; page on-call engineer |
| P2 | Medium | Anomalous API behavior, failed attestations, single-node failure with redundancy | 1-hour response; business hours |
| P3 | Low | Non-critical alerts, capacity warnings, dependency deprecations | Next business day |

### Escalation Matrix

```
P0 / P1 Incident Detected
  → Alert: PagerDuty on-call engineer (auto-page)
  → Notify: Security Lead + CTO (within 15 min)
  → Notify: DoD Program Office point of contact (within 1 hour for P0)
  → Notify: Legal counsel (within 2 hours for any breach)
  → Notify: Affected entities/customers (within 72 hours per breach notification requirements)
  → Post-incident review: within 5 business days
```

### Key Compromise Procedure

Triggered when a signing key (entity, service, or governance) is confirmed or suspected compromised.

1. **Immediate (within 15 minutes):**
   - Revoke the compromised key via the operator portal (for entity keys) or secrets manager rotation (for service keys).
   - If a governance key: trigger emergency key ceremony; suspend the affected key from the multi-sig quorum.
   - Suspend all pending transactions signed with the compromised key.

2. **Short-term (within 4 hours):**
   - Audit all transactions signed by the compromised key for the past 90 days.
   - Flag any asset records or attestations that may have been created under the compromised key for re-evaluation.
   - Rotate all service-to-service JWT signing keys (precautionary).
   - Issue replacement key through standard registration or HSM provisioning process.

3. **Remediation (within 48 hours):**
   - Re-attest any compliance records that depended on credentials or data submitted under the compromised key.
   - Notify affected downstream entities (OEMs, government auditors) with a written summary of impact and remediation.
   - Update the POA&M if a FedRAMP boundary is affected.

4. **Post-incident:**
   - Root cause analysis: how was the key exposed? Was it HSM failure, phishing, insider threat?
   - Update key management procedures accordingly.
   - File incident report per CMMC/FedRAMP requirements.

### Oracle Data Poisoning Procedure

Triggered when oracle data inconsistencies are detected (merkle root mismatch, anomalous credential changes, statistical outliers).

1. **Automatic detection:** The Oracle service performs merkle root verification on every data submission. A mismatch triggers an immediate alert and halts further credential updates until manual review clears the block.

2. **Immediate:** Freeze oracle write authority (set `oracle_paused = true` via governance multi-sig in under 30 minutes).

3. **Investigation:** Compare oracle submission logs against independent source data (OFAC API, certification bodies). Identify the scope of poisoned records.

4. **Remediation:** Re-submit correct data from a verified source with a new oracle signing key. Re-evaluate all compliance attestations that depended on the poisoned data. Notify affected parties.

5. **Post-incident:** Audit oracle source diversity; add additional cross-check sources if only one external source was compromised.

---

## Audit Trail

CritMinChain maintains a tamper-evident, comprehensive audit trail spanning both on-chain and off-chain layers.

### On-Chain Layer
Every state-changing Solana transaction is:
- Permanently recorded on the Solana ledger (immutable by design)
- Indexed by the VDIS service with decoded instruction data and account context
- Linked to its off-chain event record via the transaction signature

The ledger itself serves as the root-of-trust for the audit trail. No CritMinChain party (including the operators) can delete or modify a committed transaction.

### Off-Chain Layer
All API calls, service-to-service events, and system events are logged with:
- `actor`: entity_id or service identity (JWT sub claim)
- `timestamp`: ISO 8601 with millisecond precision
- `action`: structured action code (e.g., `asset.create`, `credentials.update`)
- `resource_id`: the affected asset, entity, or policy ID
- `result`: success or failure with error code
- `ip_address`: source IP (for external API calls)
- `tx_signature`: Solana transaction signature if the action triggered an on-chain write

### Log Chain Integrity
Off-chain logs are anchored to Solana on a configurable interval (default: every 1,000 log entries or every hour, whichever comes first):
1. A SHA-256 merkle root is computed over the batch of log entries.
2. The root is written to a `LogAnchor` PDA on Solana.
3. Any future tampering with off-chain logs will produce a merkle root mismatch detectable by anyone with access to the on-chain anchor.

### Retention
| Log Type | Retention Period | Rationale |
|----------|-----------------|-----------|
| On-chain transactions | Permanent (Solana ledger) | Immutable by design |
| Off-chain API/event logs | 7 years | CMMC AU.2.042 / DoD records retention |
| Authentication logs | 7 years | FedRAMP AU-11 |
| Compliance attestations | 7 years | DoD procurement records |
| Incident records | 7 years | CMMC IR.2.093 |

Logs older than 90 days are archived to AWS S3 Glacier (GovCloud) or Azure Archive Storage with object lock enabled to prevent deletion during the retention period.

### Access to Audit Logs
- **DoD auditors:** direct read access via DoD CAC/PIV authenticated API endpoint (`GET /audit/logs`)
- **Compliance officers:** read access scoped to their organization's events
- **Operators:** full read access; write access is prohibited (all log entries are append-only)
- **Security team:** full access including access to archived logs

Log access events are themselves logged (meta-audit trail) to detect unauthorized log access.
