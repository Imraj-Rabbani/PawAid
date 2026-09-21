# PawAid — Build Plan

---

## Stage 1 — Foundation

**Goal:** A running, authenticated backend with the full data model in place, even though most features are still empty.

**Description:**
This stage has no user-facing features yet — it's the skeleton everything else attaches to. Getting the schema and auth right early avoids painful migrations later, especially since financial entities (Wallet, FinancialTransaction) have strict relational requirements.

**Deliverables:**

- [ ] Prisma schema translated from the ER diagram — all 17 entities, relations, and enums (roles, statuses, transaction types)
- [ ] Initial migration applied to PostgreSQL
- [ ] `config/db.js`, `config/env.js` set up
- [ ] JWT-based auth: register, login, logout, token refresh (if needed)
- [ ] `auth.middleware.js` (verifies JWT) and `rbac.middleware.js` (role gate: Admin / Volunteer / Normal User)
- [ ] Basic User CRUD (self-profile view/update, admin list/suspend)
- [ ] Global `errorHandler.js` and Zod-based request validation wired into the module pattern

**Key considerations:**

- Password hashing (bcrypt or argon2) from day one
- Decide now how role escalation works (User → Volunteer) since it affects the User/VolunteerProfile relationship
- Stub out `upload.middleware.js` (Cloudinary) even if unused yet — Stage 3 needs it immediately

---



## Stage 2 — Volunteer System

**Goal:** Volunteers can apply, get a public profile, and be found by area — without any money flowing yet.

**Description:**
This is the first user-visible feature. Wallet balance and donation totals on the profile can be hardcoded to zero/placeholder until Stage 5 — the point here is the profile structure, area filtering, and the no-approval-required application flow (PRD §5.2, §32).

**Deliverables:**

- [ ] RescueArea model + admin seed/CRUD (predefined list, e.g. Dhaka → Dhanmondi, Mirpur, Uttara...)
- [ ] Volunteer application endpoint: collects name, email, phone, address, profile picture, NID, rescue area, postal code, description
- [ ] Auto-activation on application (no admin approval step, per §5.2)
- [ ] Public volunteer profile page/endpoint (name, picture, description, area, status — donation/wallet fields wired but returning 0 for now)
- [ ] Volunteer directory: list + filter by rescue area
- [ ] Admin: revoke/restore volunteer status

**Key considerations:**

- NID must never be exposed on the public profile endpoint (§39) — enforce this at the serializer level, not just the frontend
- "Volunteer can change rescue area" — model this as an update, not a new record
- Revoked volunteers should fail RBAC checks for volunteer-only actions immediately, not just hide UI

---



## Stage 3 — Community / Rescue Posts

**Goal:** Users and volunteers can create, browse, and interact with rescue posts. This is your first fully demoable feature loop.

**Description:**
Still no money involved — `donation_target` and `donation_received` fields exist on the schema but stay at their defaults. This stage proves out image upload, moderation, and the comment/report subsystems in isolation, which keeps Stage 5 (donations) focused purely on financial logic.

**Deliverables:**

- [ ] Rescue post CRUD (title, description, images, area, creator)
- [ ] Image upload via Cloudinary (multiple images per post)
- [ ] Comments (create, list, admin delete)
- [ ] Post reporting (create report, admin review queue with PENDING/REVIEWED/RESOLVED/DISMISSED states)
- [ ] Admin moderation: remove post (soft-delete — must NOT cascade-delete financial records per §26)
- [ ] Post status field scaffolded (`Awaiting Volunteer`, etc.) even though assignment logic lands in Stage 5

**Key considerations:**

- Soft-delete posts, not hard-delete, so future donation/financial records stay intact
- Image validation (type/size) belongs in `upload.middleware.js`, not per-route

---



## Stage 4 — Ledger Core

**Goal:** A standalone, independently testable financial ledger service that every later money-moving feature will call into.

**Description:**
This is infrastructure, not a feature — there's no new user-facing endpoint here. But it's the highest-risk piece in the whole system (§31, §40): wallet balances must never be treated as source-of-truth, only ever derived from or reconciled against the transaction log. Build and unit-test this in isolation before wiring donations or marketplace to it.

**Deliverables:**

- [ ] `money.util.js` — integer-cents (or poisha) conversion helpers, no floating point anywhere
- [ ] `ledger.service.js` — functions like `recordTransaction()`, `applyWalletDelta()`, wrapping everything in DB transactions (atomic by design)
- [ ] `FinancialTransaction` and `WalletTransaction` write paths, covering all five types: DONATION, WALLET_TRANSFER, MARKETPLACE_PURCHASE, MARKETPLACE_PROFIT, RESCUE_FUND_ALLOCATION
- [ ] Reconciliation query/test: sum of a wallet's transactions == wallet.balance

**Key considerations:**

- Every write to `Wallet.balance` should happen inside the same DB transaction as its corresponding `WalletTransaction` row — never update one without the other
- Write this stage with unit tests before building anything that depends on it; bugs here corrupt every downstream feature

---



## Stage 5 — Donations & Wallet

**Goal:** Money can flow from donor → post/volunteer → wallet, and volunteers can manage and move their wallet funds.

**Description:**
This is where Stage 4's ledger gets its first real callers. The critical flow is the unassigned-funds handoff (§9): a donation to a post with no assigned volunteer sits in an "unassigned" state until a volunteer self-assigns, at which point the balance transfers to their wallet — atomically.

**Deliverables:**

- [ ] Donate-to-post endpoint (routes to unassigned balance or directly to assigned volunteer's wallet depending on post state)
- [ ] Donate-to-volunteer endpoint (direct wallet credit)
- [ ] Volunteer self-assign-to-post action → triggers unassigned-funds-to-wallet transfer
- [ ] Wallet balance view + transaction history endpoint
- [ ] Volunteer-to-volunteer transfer (debit sender, credit receiver, both sides get transaction records, §13)
- [ ] Update volunteer profile to show real donation/wallet numbers (replacing Stage 2 placeholders)

**Key considerations:**

- Self-assignment and fund transfer must be one atomic operation — a post can't end up "assigned" with funds still unassigned, or vice versa
- Enforce: only one volunteer per post (MVP constraint, §9)
- Transfers need a balance check before debiting

---



## Stage 6 — Marketplace

**Goal:** A working e-commerce flow where both normal users and volunteers can buy products, with volunteers able to pay from wallet funds.

**Description:**
Structurally a standard e-commerce module, but the wallet-payment path (§35) is the new complexity — it must reuse Stage 4's ledger and fail cleanly on insufficient balance.

**Deliverables:**

- [ ] Product categories + products (cost price, selling price, stock, active flag)
- [ ] Admin product management (create/edit/deactivate, only Admin per §28)
- [ ] Order + OrderItem creation, checkout flow
- [ ] Two payment paths: simulated external payment (normal users, or volunteers paying personally) and wallet payment (volunteers only)
- [ ] `payment.service.js` — simulated provider behind an SSLCommerz-shaped interface (§23)
- [ ] Order status lifecycle: PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED / CANCELLED

**Key considerations:**

- Wallet purchase = wallet deduction + order creation + WalletTransaction, all atomic (§35, §40) — reuse `ledger.service.js`, don't reimplement
- Keep `payment.service.js` provider-agnostic so a real SSLCommerz integration can drop in later without touching order logic

---



## Stage 7 — Rescue Fund

**Goal:** Marketplace profit automatically accumulates into a rescue fund that admins can allocate back to volunteers.

**Description:**
This closes the profit loop described in §16–18 and §37. Every completed marketplace sale should trigger a profit calculation (`selling_price - cost_price` per item) that flows into the shared `RescueFund` record via a `MARKETPLACE_PROFIT` transaction.

**Deliverables:**

- [ ] Profit calculation hook on order completion (per item, summed)
- [ ] `RescueFund` accumulation (total_available, total_used)
- [ ] Admin allocation endpoint: fund → volunteer wallet, creates `RESCUE_FUND_ALLOCATION` transaction and `RescueExpense` record where applicable
- [ ] Rescue expense documentation: receipt upload tied to a transaction/order (§21)

**Key considerations:**

- Profit posting should happen once per order (idempotency — don't double-count on status changes)
- Admin cannot directly edit wallet balances (§27) — allocation must always go through the ledger

---



## Stage 8 — Financial Transparency & Admin Dashboard

**Goal:** Aggregated public financial visibility, plus a centralized admin control panel.

**Description:**
Mostly read-side work at this point — aggregating data that Stages 4–7 already produce correctly. The public overview (§19, §41) must show aggregates only, never individual donor details.

**Deliverables:**

- [ ] Public financial overview endpoint (total donations, volunteer funds, marketplace revenue/profit, rescue contribution, rescue fund available/used/remaining)
- [ ] Admin dashboard overview metrics (users, volunteers, active rescues, totals)
- [ ] Admin user management (view, suspend)
- [ ] Admin volunteer management (search/filter, view profiles, revoke/restore, view wallets — read-only)
- [ ] Admin order management (view, update status)
- [ ] Admin post moderation surface (tie into Stage 3's report queue)

**Key considerations:**

- All aggregate queries should be computed from `FinancialTransaction`/ledger data, not cached counters, to stay consistent with §31
- Keep individual donor identities out of every public-facing aggregate response

---



## Stage 9 — Polish & Security Pass

**Goal:** Harden the system for the security and integrity requirements in §39–40 before calling the MVP done.

**Description:**
A cross-cutting pass rather than a new feature — go back through every money-moving and identity-handling endpoint with this checklist.

**Deliverables:**

- [ ] Audit logs for sensitive admin actions (revoke, allocate, product changes)
- [ ] Duplicate-payment prevention (idempotency keys on payment/donation endpoints)
- [ ] File upload validation hardening (type/size limits enforced server-side)
- [ ] Confirm NID never appears in any public or list response
- [ ] Confirm every multi-step financial operation is wrapped in a DB transaction (re-audit Stages 5–7)
- [ ] End-to-end test of the full MVP success flow (PRD §43): register → post → donate → assign → wallet → purchase → profit → fund → public overview

**Key considerations:**

- This stage is your final gate before considering the MVP complete — the §43 flow is the acceptance test

