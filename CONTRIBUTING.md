# Contributing to CritMinChain

Thank you for your interest in contributing to CritMinChain. This project sits at the intersection of blockchain infrastructure, defense industrial policy, and critical mineral supply chains — a domain where correctness, auditability, and security matter enormously. We welcome contributions from developers, domain experts, and policy researchers who share that standard.

This document covers everything you need to go from zero to a merged pull request.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Reporting Issues](#reporting-issues)
3. [Development Setup](#development-setup)
4. [Repository Structure](#repository-structure)
5. [Branch Naming](#branch-naming)
6. [Commit Messages](#commit-messages)
7. [Pull Request Process](#pull-request-process)
8. [Code Style](#code-style)
9. [Testing Requirements](#testing-requirements)
10. [Documentation](#documentation)
11. [Security Disclosures](#security-disclosures)

---

## Code of Conduct

This project adheres to a Contributor Code of Conduct based on the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold a respectful, harassment-free environment for everyone regardless of background or experience level. Violations may be reported to [sam@cubiczan.com](mailto:sam@cubiczan.com).

---

## Reporting Issues

Before opening an issue, please search the existing [issue tracker](https://github.com/zan-maker/helius-pulse-forge/issues) to avoid duplicates.

**Bug reports** should include:
- A clear, descriptive title
- Steps to reproduce the behavior
- Expected behavior vs. actual behavior
- Environment details (OS, Node version, browser if applicable, Solana cluster)
- Any relevant logs or screenshots

**Feature requests** should include:
- A clear statement of the problem being solved
- Proposed solution or approach
- Any relevant policy, regulatory, or domain context (e.g., specific FEOC rule references, IRA section numbers, DoD procurement clauses)

Use the appropriate GitHub issue template when available. Label your issues correctly: `bug`, `enhancement`, `documentation`, `question`, `security` (avoid `security` for public disclosures — see [Security Disclosures](#security-disclosures) below).

---

## Development Setup

### Prerequisites

Ensure the following tools are installed before beginning:

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| [Node.js](https://nodejs.org/) | 18.x LTS | Required for the frontend |
| [npm](https://www.npmjs.com/) | 9.x | Or pnpm 8+ as an alternative |
| [Rust](https://www.rust-lang.org/tools/install) | stable (1.75+) | Required for Solana program development |
| [Anchor CLI](https://anchor-lang.com/docs/installation) | 0.30+ | Solana smart contract framework |
| [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) | 1.18+ | Required for local validator and key management |
| [Git](https://git-scm.com/) | 2.x | |

### Frontend Setup

```bash
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/<your-username>/helius-pulse-forge.git
cd helius-pulse-forge

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env and add your VITE_HELIUS_API_KEY

# 4. Start the development server
npm run dev
# Available at http://localhost:5173
```

### Solana Program Setup (for program contributors)

```bash
# Verify Solana CLI installation
solana --version

# Configure CLI to target localnet for development
solana config set --url localhost

# Generate a new keypair for local development (do not use a funded mainnet keypair)
solana-keygen new --outfile ~/.config/solana/devkey.json
solana config set --keypair ~/.config/solana/devkey.json

# Start a local validator (keep running in a separate terminal)
solana-test-validator --reset

# Airdrop SOL for transaction fees on localnet
solana airdrop 10

# Build Anchor programs (from the programs/ directory once it exists)
anchor build

# Run the Anchor test suite
anchor test
```

### Useful Scripts

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run preview      # Preview production build locally
npm run lint         # Run ESLint
npm run lint:fix     # Run ESLint with auto-fix
npm run format       # Run Prettier
npm run typecheck    # Run TypeScript compiler checks (no emit)
```

---

## Repository Structure

```
helius-pulse-forge/
├── src/
│   ├── lib/            # Solana/Helius clients, domain models, utilities
│   ├── components/     # Reusable React components
│   ├── pages/          # Route-level page components
│   └── App.tsx         # Root router and layout
├── programs/           # Anchor/Rust Solana programs (planned)
├── tests/              # Anchor integration test suite (planned)
├── docs/               # Extended documentation
├── .env.example        # Environment variable template
├── anchor.toml         # Anchor workspace config (planned)
└── package.json
```

---

## Branch Naming

All work must be done on a dedicated branch. Branch names follow this convention:

```
<type>/<short-description>
```

| Prefix | Use For |
|--------|---------|
| `feature/` | New features or capabilities |
| `fix/` | Bug fixes |
| `docs/` | Documentation changes only |
| `refactor/` | Code restructuring without behavior change |
| `test/` | Adding or improving tests |
| `chore/` | Dependency updates, tooling, CI/CD changes |
| `security/` | Security-related fixes (coordinate with maintainers first) |

**Examples:**
```
feature/asset-provenance-program
fix/helius-rpc-connection-timeout
docs/policy-profile-schemas
refactor/compliance-engine-rules
test/entity-registry-anchor-tests
```

Branch names should be lowercase, hyphen-separated, and concise. Do not include issue numbers in the branch name — link the issue in the PR instead.

---

## Commit Messages

CritMinChain uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for all commit messages. This enables automated changelog generation and clear communication of change intent.

### Format

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Formatting, missing semicolons, etc. (no logic change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |
| `chore` | Maintenance tasks, dependency bumps, CI changes |
| `perf` | Performance improvements |
| `security` | Security fix (use `!` for breaking/critical: `security!`) |

### Scope (optional but encouraged)

Use the relevant subsystem: `programs`, `frontend`, `vdis`, `compliance-engine`, `docs`, `ci`, `deps`.

### Examples

```
feat(programs): add Asset Graph Program PDA account model

fix(frontend): resolve Helius RPC connection retry loop on network timeout

docs(roadmap): add Phase 3 off-chain services detail

chore(deps): bump @solana/web3.js to 1.91.1

feat(compliance)!: change content-fraction precision from float32 to u64 basis points

BREAKING CHANGE: Attestation account layout has changed. All existing devnet
attestation accounts must be re-initialized.
```

Keep the summary line under 72 characters. Write in the imperative mood ("add", "fix", "update" — not "added", "fixed", "updated").

---

## Pull Request Process

1. **Fork** the repository to your own GitHub account.
2. **Create a branch** from `main` following the naming conventions above.
3. **Make your changes**, committing with conventional commit messages.
4. **Ensure all checks pass** locally before opening a PR:
   ```bash
   npm run typecheck
   npm run lint
   npm run format
   # For program changes:
   cargo fmt --check
   cargo clippy -- -D warnings
   anchor test
   ```
5. **Open a Pull Request** against the `main` branch of this repository.
6. **Fill out the PR template** completely, including:
   - A clear description of what the PR changes and why
   - Links to related issues (`Closes #123`)
   - Screenshots or screen recordings for UI changes
   - Test coverage summary for program changes
7. **Respond to review feedback** promptly. PRs with no activity for 30 days may be closed.
8. **Squash or rebase** your branch onto the latest `main` if it falls behind to maintain a clean history.

A maintainer will review your PR. Approval from at least one maintainer is required before merging. For changes to Solana programs, a second review from a Rust/Anchor-familiar contributor is required.

---

## Code Style

### TypeScript / React

- **Formatter:** [Prettier](https://prettier.io/) — run `npm run format` before committing. Configuration is in `.prettierrc`.
- **Linter:** [ESLint](https://eslint.org/) with the project's config — run `npm run lint`. All warnings must be resolved; errors block the PR.
- **Types:** Do not use `any`. Prefer explicit interfaces over inferred types for public-facing APIs and component props.
- **Imports:** Use absolute path aliases (configured in `vite.config.ts`) for `src/` imports. Avoid `../../../` chains.
- **Components:** Functional components only. Use named exports. Keep component files focused — split large components into smaller composites.
- **State:** Prefer React Query for server/chain state. Use `useState`/`useReducer` for local UI state.

### Rust / Anchor

- **Formatter:** `cargo fmt` — run before every commit. CI will fail on unformatted code.
- **Linter:** `cargo clippy -- -D warnings` — all Clippy warnings are treated as errors. There are no allowed exceptions without a maintainer-approved `#[allow(...)]` annotation with a documented justification comment.
- **Safety:** No `unsafe` blocks without a security review. Prefer checked arithmetic (`checked_add`, `saturating_sub`) over unchecked operations in all program logic.
- **Accounts:** Anchor account validation constraints must be explicit. Do not rely on implicit signer checks.
- **Errors:** Define custom error enums with `#[error_code]`. Error messages must be human-readable and include the program name prefix.

---

## Testing Requirements

All contributions must include appropriate tests. PRs that reduce test coverage will not be merged.

### Frontend (TypeScript)

- Unit tests for utility functions and business logic in `src/lib/` using [Vitest](https://vitest.dev/).
- Component tests for new or modified components using [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/).
- No snapshot tests — prefer behavior-based assertions.

### Solana Programs (Rust/Anchor)

- **Unit tests:** Each instruction handler must have unit tests covering the happy path and all documented error conditions. Place unit tests in `#[cfg(test)]` modules at the bottom of each program file.
- **Integration tests:** All public instructions must have integration tests in the `tests/` directory using the Anchor TypeScript test framework against a local validator.
- **Coverage target:** Aim for ≥ 80% line coverage on all new program code. Coverage reports are generated by `cargo tarpaulin`.
- **Invariant tests:** For compliance computation logic (content-fraction calculations, policy profile evaluation), include property-based tests using [`proptest`](https://github.com/proptest-rs/proptest) that verify invariants hold across randomized inputs.

### Running Tests

```bash
# Frontend unit tests
npm run test

# Frontend tests with coverage
npm run test:coverage

# Anchor program tests (requires local validator running)
anchor test

# Rust unit tests only
cargo test

# Rust tests with coverage
cargo tarpaulin --out Html
```

---

## Documentation

- All public functions, structs, and traits in Rust code must have doc comments (`///`).
- All exported TypeScript functions and interfaces in `src/lib/` must have JSDoc comments.
- Significant new features must include an update to the relevant `docs/` file or a new `docs/` document.
- The `docs/ROADMAP.md` should be updated when a planned milestone is completed or its scope changes.

---

## Security Disclosures

**Do not open a public GitHub issue for security vulnerabilities.** This is especially important for issues affecting Solana program logic, account validation, or compliance computation — a publicly disclosed vulnerability in a program handling defense-sensitive supply chain data could have serious consequences.

Please report security vulnerabilities directly to [sam@cubiczan.com](mailto:sam@cubiczan.com) with the subject line `[SECURITY] CritMinChain — <brief description>`. Include:

- A description of the vulnerability
- Steps to reproduce or a proof-of-concept
- Potential impact assessment
- Any suggested mitigations

You will receive an acknowledgment within 72 hours. We aim to triage and patch critical vulnerabilities within 14 days and will credit responsible disclosures in the release notes.
