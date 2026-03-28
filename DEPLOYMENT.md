# Deployment Guide

This guide covers deploying the full CritMinChain stack: the Anchor/Solana on-chain program, the off-chain microservices (VDIS, Compliance Engine, Oracle), the frontend dashboard, and supporting infrastructure.

---

## Prerequisites

Ensure the following tools are installed and configured before proceeding.

### Runtime & Toolchain

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| Node.js | 18.x LTS | v20 recommended; use `nvm` for version management |
| Rust | 1.75+ | Install via `rustup`: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Solana CLI | 1.18+ | `sh -c "$(curl -sSfL https://release.solana.com/stable/install)"` |
| Anchor CLI | 0.30+ | `cargo install --git https://github.com/coral-xyz/anchor avm --locked && avm install 0.30.0 && avm use 0.30.0` |
| Docker | 24.x+ | Required for local off-chain service development and CI |
| Docker Compose | v2 | Included with Docker Desktop; `docker compose` (not `docker-compose`) |
| PostgreSQL client | 15+ | `psql` for schema migrations; the server is containerized |

### External Services

| Service | Purpose | Setup |
|---------|---------|-------|
| Helius | Solana RPC + Enhanced Transactions API | Register at [dev.helius.xyz](https://dev.helius.xyz) and obtain an API key |
| AWS / Azure | Hosting for government workloads | AWS GovCloud or Azure Government account required for production defense deployments |
| HSM (optional) | Entity signing key custody | AWS CloudHSM or Azure Managed HSM for production key management |

---

## Repository Structure

```
critminchain/
├── programs/
│   └── critminchain/        # Anchor program (Rust)
│       └── src/lib.rs
├── tests/                   # TypeScript integration tests
├── migrations/              # Anchor migration scripts
├── app/                     # Vite + React frontend
├── services/
│   ├── vdis/                # Verifiable Data Indexing Service
│   ├── compliance-engine/   # Policy evaluation microservice
│   └── oracle/              # Off-chain data oracle
├── db/
│   └── migrations/          # PostgreSQL schema migrations (Flyway/Knex)
├── docker/
│   ├── docker-compose.yml
│   └── docker-compose.prod.yml
├── infra/                   # Terraform / CDK infrastructure code
├── Anchor.toml
└── package.json
```

---

## Environment Variables

Copy `env.example` to `.env` in the repository root and populate all required values. Never commit `.env` to version control.

```env
# ── Solana ───────────────────────────────────────────────────────────────────
# Helius RPC endpoint (replace YOUR_KEY with your actual Helius API key)
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# Network: mainnet-beta | devnet | localnet
SOLANA_NETWORK=mainnet-beta

# Path to the deployer keypair JSON file
ANCHOR_WALLET=~/.config/solana/id.json

# Program ID (set after first deployment)
PROGRAM_ID=CritM...1111

# ── Helius ────────────────────────────────────────────────────────────────────
HELIUS_API_KEY=your-helius-api-key

# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://critminchain:your-db-password@localhost:5432/critminchain

# ── Off-Chain Services ────────────────────────────────────────────────────────
VDIS_PORT=3001
COMPLIANCE_ENGINE_PORT=3002
ORACLE_PORT=3003

# Internal service base URLs (used for inter-service calls)
VDIS_URL=http://localhost:3001
COMPLIANCE_ENGINE_URL=http://localhost:3002
ORACLE_URL=http://localhost:3003

# ── Security ──────────────────────────────────────────────────────────────────
# RS256 private key for JWT signing (PEM format, base64-encoded)
JWT_SECRET=your-jwt-secret

# Comma-separated list of governance multi-sig public keys (3-of-5)
GOVERNANCE_MULTISIG=PublicKey1,PublicKey2,PublicKey3,PublicKey4,PublicKey5

# ── Frontend ─────────────────────────────────────────────────────────────────
VITE_HELIUS_API_KEY=your-helius-api-key
VITE_API_BASE_URL=https://api.critminchain.io/v1
VITE_SOLANA_NETWORK=mainnet-beta

# ── Monitoring ────────────────────────────────────────────────────────────────
DATADOG_API_KEY=your-datadog-api-key
PAGERDUTY_INTEGRATION_KEY=your-pagerduty-key
LOG_LEVEL=info
```

### Secrets Management

In production, inject secrets via:
- **AWS**: Secrets Manager + IAM role binding; reference secrets by ARN in ECS task definitions.
- **Azure**: Key Vault + managed identity; reference secrets in App Service configuration.
- **Kubernetes**: External Secrets Operator backed by AWS Secrets Manager or Azure Key Vault.

Never hardcode secrets in container images, Anchor.toml, or committed configuration files.

---

## Frontend Deployment

The frontend is a Vite + React single-page application with Wallet Adapter integration for Solana wallet connectivity.

### Local Development

```bash
cd app
npm install
cp ../.env .env.local        # copy root env vars to app env
npm run dev                  # starts Vite dev server at http://localhost:5173
```

### Production Build

```bash
cd app
npm install
npm run build                # outputs to app/dist/
npm run preview              # preview production build locally
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

cd app
vercel --prod
# Set environment variables in the Vercel dashboard under Settings > Environment Variables
```

Required Vercel environment variables:
- `VITE_HELIUS_API_KEY`
- `VITE_API_BASE_URL`
- `VITE_SOLANA_NETWORK`

### Deploy to Cloudflare Pages

```bash
# Connect the GitHub repository in the Cloudflare dashboard
# Build command: npm run build
# Build output directory: dist
# Set environment variables in Pages > Settings > Environment Variables
```

### Deploy to S3 + CloudFront (AWS GovCloud)

```bash
# Build the app
cd app && npm run build

# Upload to S3
aws s3 sync dist/ s3://critminchain-frontend-prod/ \
  --delete \
  --cache-control "max-age=31536000,immutable" \
  --exclude "index.html"

aws s3 cp dist/index.html s3://critminchain-frontend-prod/index.html \
  --cache-control "no-cache"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_CF_DIST_ID \
  --paths "/*"
```

---

## Solana Program Deployment

### Build

```bash
# From the repository root
anchor build

# Verify the generated program ID matches your keypair
anchor keys list
```

After the first build, copy the generated program ID into:
- `Anchor.toml` under `[programs.mainnet-beta]`
- `programs/critminchain/src/lib.rs` `declare_id!()` macro
- `.env` `PROGRAM_ID` variable

Then rebuild: `anchor build`

### Local Validator Testing

```bash
# Start a local Solana test validator
solana-test-validator

# In a separate terminal, run the Anchor test suite
anchor test --provider.cluster localnet

# Run individual test files
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/asset-lifecycle.ts
```

### Devnet Deployment

```bash
# Configure CLI for devnet
solana config set --url https://api.devnet.solana.com

# Airdrop SOL for deployment gas
solana airdrop 2

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Verify deployment
solana program show <PROGRAM_ID>
```

### Mainnet Deployment

> **Caution:** Mainnet deployment is irreversible. Ensure all tests pass on devnet and the upgrade authority is set to the governance multi-sig before proceeding.

```bash
# Configure CLI for mainnet
solana config set --url https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# Verify wallet balance (deployment costs ~5-10 SOL depending on program size)
solana balance

# Deploy to mainnet
anchor deploy --provider.cluster mainnet-beta

# Set upgrade authority to governance multi-sig (REQUIRED for production)
solana program set-upgrade-authority <PROGRAM_ID> \
  --new-upgrade-authority <GOVERNANCE_MULTISIG_PUBKEY>

# Verify upgrade authority
solana program show <PROGRAM_ID>
```

### Program Upgrade (Post-Launch)

All program upgrades must go through the multi-sig governance process (48-hour timelock). See [SECURITY.md](./SECURITY.md) for the upgrade procedure.

```bash
# Build new version
anchor build

# Stage upgrade (does not activate immediately)
solana program write-buffer target/deploy/critminchain.so

# Submit upgrade proposal to Squads multi-sig
# (use Squads CLI or UI at https://v3.squads.so)
squads-cli proposal create \
  --multisig <MULTISIG_PDA> \
  --program-id <PROGRAM_ID> \
  --buffer <BUFFER_ADDRESS>

# After 48 hours and required approvals, execute upgrade
squads-cli proposal execute --proposal-id <PROPOSAL_ID>
```

---

## Off-Chain Services Deployment

The three off-chain microservices (VDIS, Compliance Engine, Oracle) are deployed as Docker containers orchestrated by Docker Compose for development and ECS/AKS for production.

### Local Development (Docker Compose)

```bash
# Start all services + PostgreSQL
docker compose -f docker/docker-compose.yml up -d

# View logs
docker compose -f docker/docker-compose.yml logs -f

# Stop all services
docker compose -f docker/docker-compose.yml down
```

`docker/docker-compose.yml`:
```yaml
version: "3.9"
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: critminchain
      POSTGRES_USER: critminchain
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U critminchain"]
      interval: 10s
      timeout: 5s
      retries: 5

  vdis:
    build: ./services/vdis
    ports:
      - "${VDIS_PORT}:3001"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      SOLANA_RPC_URL: ${SOLANA_RPC_URL}
      HELIUS_API_KEY: ${HELIUS_API_KEY}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  compliance-engine:
    build: ./services/compliance-engine
    ports:
      - "${COMPLIANCE_ENGINE_PORT}:3002"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      VDIS_URL: ${VDIS_URL}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      vdis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  oracle:
    build: ./services/oracle
    ports:
      - "${ORACLE_PORT}:3003"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      VDIS_URL: ${VDIS_URL}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
```

### Database Schema Migrations

Migrations are managed with Flyway (or Knex if preferred for TypeScript-native workflows).

```bash
# Run migrations (Flyway)
docker run --rm \
  -e FLYWAY_URL=jdbc:postgresql://localhost:5432/critminchain \
  -e FLYWAY_USER=critminchain \
  -e FLYWAY_PASSWORD=$POSTGRES_PASSWORD \
  -v $(pwd)/db/migrations:/flyway/sql \
  flyway/flyway:10 migrate

# Check migration status
docker run --rm ... flyway/flyway:10 info
```

Migration files follow the naming convention `V{version}__{description}.sql`, e.g.:
- `V1__initial_schema.sql`
- `V2__add_compliance_tables.sql`
- `V3__add_audit_log.sql`

### Health Check Endpoints

Each service exposes a `/health` endpoint:

```json
// GET http://localhost:3001/health
{
  "status": "ok",
  "service": "vdis",
  "version": "1.2.0",
  "uptime_seconds": 3600,
  "dependencies": {
    "postgres": "ok",
    "solana_rpc": "ok",
    "helius": "ok"
  }
}
```

### Logging

All services emit structured JSON logs compatible with ELK (Elasticsearch + Logstash + Kibana) and Datadog:

```json
{
  "timestamp": "2026-03-28T12:00:05.123Z",
  "level": "info",
  "service": "vdis",
  "trace_id": "abc123",
  "message": "Asset created",
  "asset_id": "asset_4b8e2f1a",
  "entity_id": "ent_7a3f9c2d",
  "tx_signature": "5J7Kv...wP2",
  "duration_ms": 312
}
```

Set `LOG_LEVEL=debug` in development for verbose output. Use `info` in production.

---

## Infrastructure

### Recommended Cloud Environments

| Workload | Recommended Platform | Notes |
|----------|---------------------|-------|
| Defense / DoD contracts | AWS GovCloud (US) or Azure Government | Required for CUI handling; FedRAMP boundary |
| Commercial | AWS, GCP, or Azure (standard regions) | Lower cost; no FedRAMP requirement |
| Frontend CDN | Cloudflare or AWS CloudFront | Edge caching for global performance |

### AWS GovCloud Reference Architecture

```
Internet
  └── Route 53 (DNS)
        ├── CloudFront (CDN) → S3 (frontend static assets)
        └── ALB (WAF attached)
              ├── ECS Fargate — VDIS (service: vdis)
              ├── ECS Fargate — Compliance Engine
              └── ECS Fargate — Oracle
                    └── RDS PostgreSQL 15 (Multi-AZ)
                          └── AWS Secrets Manager (env vars)

Solana Interaction
  └── Helius Dedicated Node (mainnet-beta)
        └── VDIS service
```

### Terraform Quickstart

```bash
cd infra/terraform

# Initialize
terraform init

# Plan (review before applying)
terraform plan -var-file=production.tfvars

# Apply
terraform apply -var-file=production.tfvars
```

### Helius RPC Configuration

For production workloads, provision a **dedicated Helius node** rather than using the shared endpoint:

1. Log in to the [Helius dashboard](https://dev.helius.xyz)
2. Under **Dedicated Nodes**, create a new mainnet-beta node
3. Set the dedicated RPC URL as `SOLANA_RPC_URL` in your secrets manager
4. Configure WebSocket endpoint for real-time event subscriptions

### WAF Configuration

Apply AWS WAF or Cloudflare WAF rules to the API load balancer:
- Enable OWASP Core Rule Set (CRS)
- Rate limiting: 100 req/min per IP for public endpoints
- Geo-blocking: restrict access by country as required by export controls
- SQL injection and XSS protection rules enabled

---

## Monitoring

### Solana Program Monitoring

| Metric | Description | Alert Threshold |
|--------|-------------|----------------|
| Transaction success rate | % of CritMinChain program txs that succeed | < 99% over 5 min |
| Compute unit usage | Average CUs per instruction | > 80% of limit |
| Slot lag | Age of most recently processed slot | > 10 slots |

```bash
# Query recent program transactions via Helius
curl "https://api.helius.xyz/v0/addresses/<PROGRAM_ID>/transactions?api-key=$HELIUS_API_KEY&limit=50"
```

### Off-Chain Service Monitoring

Key metrics to track per service:

| Metric | Tool | Alert |
|--------|------|-------|
| HTTP error rate (5xx) | Datadog APM | > 1% over 1 min |
| API latency (p99) | Datadog APM | > 2s |
| Job queue depth | Datadog metrics | > 100 pending jobs |
| DB connection pool saturation | pg_stat_activity | > 80% utilized |
| Memory usage | Container metrics | > 85% of limit |

### Datadog Integration

```bash
# Add Datadog agent sidecar to ECS task definition
# (see infra/terraform/ecs_task_definition.tf for full config)

# Key Datadog integrations to enable:
# - AWS ECS integration
# - PostgreSQL integration
# - Custom metrics via StatsD (UDP port 8125)
```

### PagerDuty Alerting

Configure the following PagerDuty escalation policies:
- **P0 (Critical):** Solana program unresponsive, attestation service down, database unreachable — immediate page
- **P1 (High):** Error rate > 1%, queue depth > 500, latency p99 > 5s — 15-minute response
- **P2 (Medium):** Degraded performance, single node failure with redundancy — business hours response
- **P3 (Low):** Non-critical warnings, capacity planning alerts — next business day

```bash
# Test PagerDuty integration
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "routing_key": "'$PAGERDUTY_INTEGRATION_KEY'",
    "event_action": "trigger",
    "payload": {
      "summary": "CritMinChain VDIS health check failed",
      "severity": "critical",
      "source": "critminchain-monitoring"
    }
  }'
```

### Database Monitoring

```sql
-- Monitor active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Identify slow queries (> 1 second)
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - pg_stat_activity.query_start > INTERVAL '1 second'
ORDER BY duration DESC;

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## CI/CD Pipeline

### GitHub Actions Overview

```yaml
# .github/workflows/ci.yml (abbreviated)
name: CI

on: [push, pull_request]

jobs:
  test-anchor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions-rs/toolchain@v1
        with: { toolchain: stable }
      - name: Install Solana + Anchor
        run: |
          sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"
          cargo install --git https://github.com/coral-xyz/anchor avm --locked
          avm install 0.30.0 && avm use 0.30.0
      - run: anchor build
      - run: anchor test

  test-services:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: critminchain_test
          POSTGRES_USER: critminchain
          POSTGRES_PASSWORD: testpass
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npm test

  deploy-devnet:
    needs: [test-anchor, test-services]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: anchor deploy --provider.cluster devnet
```

---

## Rollback Procedures

### Frontend Rollback
Redeploy the previous build artifact from S3 or re-point the Vercel deployment alias to the previous deployment.

### Service Rollback
ECS supports instant rollback to the previous task definition revision:
```bash
aws ecs update-service \
  --cluster critminchain-prod \
  --service vdis \
  --task-definition vdis:PREVIOUS_REVISION
```

### Solana Program Rollback
Requires the governance multi-sig. Deploy the previous program binary from its buffer, following the upgrade procedure in [SECURITY.md](./SECURITY.md). Note: on-chain state (account data) is not rolled back by a program upgrade.
