# LeagueXI Final Pre-Cutover Roadmap

## Purpose

This document defines the remaining work between the current post-WC web build and production cutover.

It does **not** replace:

- `docs/native-backend-contract.md`
- `docs/cutover-runbook.md`
- `docs/decision-log.md`

Those remain the authoritative documents for their respective domains.

This roadmap exists only to define sequencing, dependencies, and project milestones.

---

# Current State

The post-WC web application is feature complete and has completed visual QA and polish.

The Native Backend Contract is **FROZEN** — P-1, P-2, and P-3 are completed: the leaderboard Top-N/caller contract is **implemented** (`0018`), **staging-validated**, and **verified against live staging**. (P-4 remains an open authentication-flow decision that does not affect the frozen contract shape.)

This roadmap governs the remaining work required to move from the current state to production cutover.

---

# Guiding Principles

## Repository First

The repository is the source of truth.

Where repository, documentation, and assumptions disagree:

- trust the repository;
- update the documentation;
- discard the assumption.

---

## Native Backend Contract

`docs/native-backend-contract.md` is the canonical backend interface consumed by all LeagueXI clients.

The Native Backend Contract becomes **FROZEN** once all remaining contract-shape decisions have been resolved.

---

## UI Independence

UI and UX improvements must not reopen the Native Backend Contract unless they require new backend capabilities.

---

## Evidence Over Assumption

Unknowns remain explicitly marked as **UNKNOWN** until verified.

Do not infer infrastructure, dashboard configuration, or production behavior from application code alone.

---

# Phase 1. Native Backend Contract Finalization

Resolve the remaining contract-shape decisions:

- **P-1:** Leaderboard RPC contract (Top-50 decision)

  If Top-50 is adopted, this introduces an additional migration and requires staging validation and regenerated database types before the Native Backend Contract can be frozen.

- **P-2:** `kickoff_at` compatibility decision

- **P-3:** Helper RPC canonicalization and quarantine/removal of the known incorrect duplicate

These are the only remaining items that may change the backend interface consumed by the future native application.

Once resolved:

- update `docs/native-backend-contract.md`;
- change its status from **DRAFT** to **FROZEN**.

---

# Milestone

## Native Backend Contract: **FROZEN**

Reaching this milestone releases both parallel workstreams:

- **Track A:** Native Development
- **Track B:** Provider Integration Validation

---

# Contract Freeze Rule

Once the Native Backend Contract is **FROZEN**, backend changes should default to being backward compatible.

Avoid breaking contract changes after freeze.

If a breaking contract change becomes necessary before native has been submitted for store review:

- update the Native Backend Contract;
- update every affected client;
- keep all implementations synchronized before production cutover.

If a breaking contract change becomes necessary after native has been submitted for store review, treat it as a schedule event because it requires:

- updating the Native Backend Contract;
- a new native build;
- a new App Store and Google Play submission/review cycle;
- coordinated updates to every affected client.

The Native Backend Contract remains the canonical source of truth for all client integrations.

---

# Phase 2. Parallel Execution

Contract freeze releases two independent workstreams.

## Track A. Native Development

Begin a brand new Claude Code session dedicated to the post-WC native application.

Build against:

- the frozen Native Backend Contract;
- the migrated staging database;
- generated database types;
- the Supabase proxy architecture.

### Scheduling Note

Native development is the project's critical path because it includes external App Store and Google Play review timelines.

Provider Integration Validation should run in parallel and complete before Operational Cutover Rehearsal, but native progress determines the overall cutover schedule.

Native development may begin while **P-4** remains unresolved because P-4 affects authentication flow rather than backend contract shape.

Implement the native authentication flow against the documented authentication assumption and clearly flag it for reconciliation once P-4 is resolved before the authentication experience is finalized.

---

## Track B. Provider Integration Validation

Run entirely on staging.

Validate:

- provider IDs;
- fixture discovery;
- fixture inclusion/exclusion;
- fixture synchronization;
- round progression;
- automatic scoring;
- leaderboard recalculation;
- sync monitoring;
- admin overrides.

The objective is to validate the complete provider pipeline using real provider data.

---

# Phase 3. Product & Authentication Finalization

Resolve only remaining product-flow decisions that do **not** affect backend contract shape.

Current scope:

- **P-4:** Email Confirmation Link Validation
- Live authentication issues affecting current users

**Parked unless explicitly reactivated:**

- Google Sign-In
- Apple Sign-In
- Broad UI/UX polish
- Additional product enhancements

---

## P-4. Email Confirmation Link Validation

### Current State

Production currently disables email confirmation (**dashboard-verified**) and immediately signs users in after email/password signup.

### Current Understanding

Historical project records indicate that some Nigerian users received the confirmation email but were unable to successfully complete account validation through the hosted confirmation flow.

Current evidence does **not** support concluding that SMTP or email deliverability is the root cause.

The precise technical root cause remains **UNKNOWN** and requires evidence-based investigation.

### Impact

- Does **NOT** block Native Backend Contract freeze.
- Does block finalization of the native authentication experience.

Native development may continue against the documented authentication assumption and reconcile the final signup/authentication flow once P-4 has been resolved.

---

# Phase 4. Native QA

The two parallel tracks converge.

Validate the native application against:

- real provider-fed fixtures;
- real match results;
- automatic scoring;
- leaderboards;
- authentication;
- notifications;
- league management;
- prediction flows;
- edge cases.

This is the first point where native requires realistic production-like data.

---

# Phase 5. Operational Cutover Rehearsal

Assuming Provider Integration Validation has already passed, perform a complete operational rehearsal following `docs/cutover-runbook.md`.

Validate:

- deployment;
- monitoring;
- logging;
- alerting;
- cron jobs;
- rollback;
- operational readiness.

Nothing new is built during this phase.

Everything is validated.

---

# Phase 6. Production Cutover

Production cutover proceeds only when:

- the Native Backend Contract is **FROZEN**;
- the native application is complete;
- the native application has been approved and is live in both app stores;
- Provider Integration Validation has passed;
- Native QA has passed;
- Operational Cutover Rehearsal has passed;
- the production environment has been verified.

Production cutover is then executed according to `docs/cutover-runbook.md`.

---

# Final Principle

The Native Backend Contract defines the boundary between the backend and every client.

Native development is the project's critical path.

Once the Native Backend Contract is frozen, nothing should delay native development or store submission unless it changes the backend contract itself or resolves a production issue affecting current users.
