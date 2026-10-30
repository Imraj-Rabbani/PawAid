# PawAid — Build Plan

**Last updated:** 2026-10-30

| Stage | Status |
| --- | --- |
| 1 — Foundation | ✅ Done (with changes) |
| 2 — Volunteer System | ✅ Done |
| 3 — Community / Rescue Posts | ✅ Done, extended |
| 4 — Ledger Core | ✅ Done (with changes) |
| 5 — Donations & Wallet | ✅ Done (with changes) |
| 6 — Marketplace | ✅ Done (with changes) |
| 7 — PawAid Fund (Rescue Fund) | ✅ Done (with changes) |
| 8 — Financial Transparency & Admin Dashboard | ✅ Done |
| 9 — Polish & Security Pass | 🟡 In progress |

Legend: `[x]` done · `[~]` done differently than planned (see note) · `[ ]` not done.
"PRD Dn" refers to the Decision Log in PRD §44.

---

## Stage 1 — Foundation

**Goal:** A running, authenticated backend with the full data model in place, even though most features are still empty.

**Description:**
This stage has no user-facing features yet — it's the skeleton everything else attaches to. Getting the schema and auth right early avoids painful migrations later, especially since financial entities (Wallet, FinancialTransaction) have strict relational requirements.

**Deliverables:**

- [x] Prisma schema translated from the ER diagram — entities, relations, and enums (roles, statuses, transaction types). Now 26 models after later additions (RescueUpdate, RescueUpdateImage, PostUpvote, IdempotencyKey, AdminAuditLog, Session, UsageAlert, PasswordReset).
- [x] Initial migration applied to PostgreSQL (18 migrations to date)
- [~] `config/env.js` set up; the DB client lives in `src/db.js` (Prisma 7 with the `pg` adapter)
- [~] JWT-based auth: register, login. Token in an httpOnly cookie, backed by a server-side session: `POST /signout` and `POST /signout/all` revoke it, and suspension ends all of a user's sessions; no refresh token, 7-day expiry instead (PRD D24)
- [~] `auth.middleware.js` (`requireAuth`, `optionalAuth`). RBAC split into `admin.middleware.js` and `volunteer.middleware.js` instead of one `rbac.middleware.js`
- [x] Basic User CRUD (self-profile view/update, profile picture upload, admin list/suspend)
- [~] Global error handler inline in `app.js` (`server.js` only starts the app, so tests can drive `app.js` directly). Zod body validation is shared middleware (`validateBody`, schemas in `src/schemas/`)

**Added beyond the plan:**

- [x] Google sign-in (`POST /signin/google`): the ID token is verified server side; an existing email/password account with the same verified email is linked rather than duplicated
- [x] Forgot password (`POST /password/forgot`, `POST /password/reset`, `/forgot-password`, `/reset-password`): emailed single-use link, 30 minute expiry, only a hash of the token stored, same reply whether or not the email has an account, rate limited per IP and per email, and a reset signs the account out everywhere. Google-only accounts can use it to add a password
- [x] Email sending through Resend (`email.services.js`), used by password resets and the R2 usage alerts
- [x] CAPTCHA on email/password sign in and sign up (Cloudflare Turnstile, `captcha.middleware.js`): the browser sends the widget's token in `X-Captcha-Token` and the API checks it with Cloudflare. On sign in it runs before the per-email rate limit, so bots can't lock someone's account. Off while `TURNSTILE_SECRET_KEY` is unset (local dev, tests)

**Key considerations:**

- Password hashing with bcrypt from day one — done
- Password reset emails only reach real users once a domain is verified in Resend and set as `EMAIL_FROM`; until then Resend delivers only to the account owner's address
- Role escalation: applying creates a `VolunteerProfile` and sets the user's role to `VOLUNTEER` in one transaction; revocation changes the profile status, not the role (PRD D5)
- Uploads go to **Cloudflare R2** via `upload.services.js`, not Cloudinary (PRD D24). A free tier guard (`r2Usage.services.js`) checks usage every 15 minutes, emails at 80% and pauses uploads at 90% (see Stage 9)

---

## Stage 2 — Volunteer System

**Goal:** Volunteers can apply, get a public profile, and be found by area — without any money flowing yet.

**Description:**
This is the first user-visible feature. Wallet balance and donation totals on the profile could be placeholders until Stage 5 — the point here is the profile structure, area filtering, and the no-approval-required application flow (PRD §5.2, §32).

**Deliverables:**

- [x] RescueArea model + admin CRUD (add, rename, delete only if unused)
- [~] Volunteer application endpoint: rescue area and NID required; phone, address, description optional; name/email/picture come from the account (PRD D4)
- [x] Auto-activation on application (no admin approval step, per §5.2)
- [x] Public volunteer profile page/endpoint (name, picture, description, area, status, donation totals, wallet totals and public wallet history)
- [x] Volunteer directory: list + filter by rescue area
- [x] Admin: revoke/restore volunteer status

**Key considerations:**

- NID never exposed on the public profile or directory — enforced in the Prisma `select`
- Changing rescue area is an update to the profile
- Revoked volunteers fail `requireActiveVolunteer` immediately

---

## Stage 3 — Community / Rescue Posts

**Goal:** Users and volunteers can create, browse, and interact with rescue posts. This is the first fully demoable feature loop.

**Deliverables:**

- [x] Rescue post CRUD (title, description, images, area, creator, optional donation target)
- [~] Image upload via R2 (up to 5 images per post)
- [x] Comments (create, paginated list, delete by author or admin)
- [~] Post reporting (create report, admin review queue with PENDING/REVIEWED/RESOLVED/**REJECTED**) (PRD D9)
- [x] Admin moderation: take down = status `CANCELLED`, financial records kept (PRD D10)
- [x] Refund held donations when an admin moves a post with no volunteer out of `OPEN` (take down, Closed, Resolved); refunded donations excluded from all totals (PRD §11, §26)
- [x] Post status lifecycle `OPEN → ASSIGNED → IN_PROGRESS → RESOLVED`, plus `CLOSED`/`CANCELLED` (PRD D6)

**Added beyond the plan:**

- [x] Post upvotes (one per user, toggle)
- [x] Homepage feed with cursor pagination and tabs (Latest / Needs a Volunteer / Fundraising / Rescued)
- [x] Ranked "For You" feed, the default (`feed.services.js`, `?sort=ranked`): scored by status, the viewer's area, how close a fundraiser is to its target, and engagement (upvotes, comments, donors) on a log scale, with posts losing rank as they age; "Latest" keeps the newest-first order (PRD §8)
- [x] User area: any user can choose their area on the profile page (`users.area_id`) so the feed puts rescues there first; volunteers fall back to their rescue area. Private to the owner
- [x] Creator can edit/delete only while open and unassigned; no delete once donations exist (PRD D7)
- [x] Volunteer progress: In Progress → Rescued with closing note and photo
- [x] Rescue updates timeline (notes + up to 4 photos) by the assigned volunteer
- [x] Rescue details page (`/rescue/:postId`) with gallery, donation card, volunteer card, updates, expenses, comments
- [x] "Rescues" tab on the profile page (posted / handling)

**Key considerations:**

- Posts are soft-deleted by admins; creator deletes are only allowed when no money is attached
- Image type/size validation lives in `upload.middleware.js` (images only, 5 MB)

---

## Stage 4 — Ledger Core

**Goal:** A ledger layer that every money-moving feature calls into.

**Description:**
Wallet balances must never be the sole source of truth (§31, §40). Instead of a single `ledger.service.js`, the ledger is the `FinancialTransaction` table plus two helper services that every money flow uses inside a `prisma.$transaction`.

**Deliverables:**

- [~] Money as whole-taka integers (`Int` columns); no `money.util.js` needed since amounts are never fractional (PRD D21)
- [~] `wallet.services.js` (`creditWallet`, `debitWallet` with an atomic balance check) and `fund.services.js` (`creditFund`, `debitFund`), always called inside a DB transaction
- [~] `FinancialTransaction` + `WalletTransaction` write paths for the implemented types: INCOME, DONATION, TRANSFER, ORDER_PAYMENT, REFUND, MARKETPLACE_PROFIT, RESCUE_FUND_ALLOCATION (PRD D20)
- [x] Reconciliation check: `findLedgerProblems` (`ledger.services.js`) compares wallet balances, post totals and the PawAid Fund against their transaction rows. Tests call it after every money flow, and `npm run check:ledger` runs it against a real database
- [~] Wallet and fund services are tested through the API flows that use them (`donations`, `orders`, `ledger`, `concurrency` test files) rather than as isolated unit tests

**Key considerations:**

- Every write to `Wallet.balance` happens in the same DB transaction as its `WalletTransaction` row — done
- DB constraints: a donation has exactly one source (user or fund); the fund can't be overdrawn
- Tests run with Vitest and supertest against a throwaway embedded Postgres (`npm test`), so they never touch a real database
- Concurrency tests check that simultaneous donations, transfers, checkouts, fund donations and rescue claims can't overspend or pay twice

---

## Stage 5 — Donations & Wallet

**Goal:** Money can flow from donor → post/volunteer → wallet, and volunteers can manage and move their wallet funds.

**Description:**
The critical flow is the unassigned-funds handoff (§9): a donation to a post with no assigned volunteer sits on the post until a volunteer self-assigns, at which point the balance transfers to their wallet — atomically.

**Deliverables:**

- [x] Donate-to-post endpoint (held on the post, or straight to the assigned volunteer's wallet)
- [x] Donate-to-volunteer endpoint (direct wallet credit)
- [x] Volunteer self-assign-to-post action → unassigned funds moved to wallet in the same transaction
- [x] Wallet balance view + paginated transaction history with in/out totals
- [x] Volunteer-to-volunteer transfer with optional note (§13)
- [x] Volunteer profile shows real donation/wallet numbers

**Added / changed:**

- [~] Every user has a wallet, created at sign up (migration `wallet_per_user`) (PRD D1)
- [~] Donations are paid from the donor's wallet; demo wallet top up is the only way money enters (PRD D2)
- [x] Self-donation rules: not to yourself, your own post, or a rescue you handle (PRD D3)
- [x] Donation history: platform-wide `/donations` page and a Donations tab on the profile (made / received)

**Key considerations:**

- Assignment uses a conditional update so only one volunteer can claim a post — done
- Balance checks are part of the debit statement, so concurrent requests can't overspend — done

---

## Stage 6 — Marketplace

**Goal:** A working e-commerce flow where both normal users and volunteers can buy products, with volunteers able to pay from wallet funds.

**Deliverables:**

- [x] Product categories + products (cost price, selling price, stock, active flag, description, image)
- [x] Admin product management (create/edit/deactivate; price can't be below cost) (PRD D15)
- [x] Order + OrderItem creation, checkout flow (unit price and unit cost snapshotted)
- [~] Payment paths: **cash on delivery** (everyone) and **wallet** (any user; frozen for revoked volunteers). Online/simulated external payment switched off (PRD D12)
- [~] `payment.services.js` has a simulated provider behind an SSLCommerz-shaped interface, but it is not wired in
- [~] Order status lifecycle: PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED, cancel any time before delivery; `REFUNDED` added (PRD D13, D14)

**Added beyond the plan:**

- [x] Storefront and product details page with category filter and "you may also like"
- [x] Cart (browser storage, per user, re-synced with server prices/stock) (PRD D16)
- [x] Address management on the profile; delivery details snapshotted on each order
- [x] Price-change check at checkout (`expectedTotal`)
- [x] Cancelling restocks items and refunds wallet payments through the ledger
- [x] Orders tab on the profile + order details page

**Key considerations:**

- Stock reservation, order, payment, ledger entry and wallet debit are one transaction — done
- Products are locked in a fixed order to avoid deadlocks between concurrent checkouts

---

## Stage 7 — PawAid Fund (Rescue Fund)

**Goal:** Marketplace profit accumulates into a fund that admins can give back to volunteers and rescues.

**Deliverables:**

- [~] Profit posted when an order is marked **Delivered** (per item: (unit price − unit cost) × quantity) (PRD D17)
- [x] Single `RescueFund` row (the PawAid Fund) tracking total received (`total_available`) and total given (`total_used`)
- [~] Admin allocation is a **donation from the fund** to a volunteer or a rescue post, recorded as `RESCUE_FUND_ALLOCATION` and naming the admin (PRD D18)
- [~] Rescue expense documentation: the assigned volunteer records expenses with a receipt photo and/or a linked marketplace order. Documentation only, no money moves (PRD D19)

**Key considerations:**

- Profit is posted once per order: DELIVERED can only be reached once
- Admin cannot edit balances directly; every allocation goes through the ledger and fails if the fund is short

---

## Stage 8 — Financial Transparency & Admin Dashboard

**Goal:** Aggregated public financial visibility, plus a centralized admin control panel.

**Deliverables:**

- [x] Public financial overview (`/transparency`): donations, top ups, volunteer funds, rescues, documented expenses, marketplace revenue/profit, PawAid Fund received/donated/balance, recent fund donations
- [x] Admin dashboard overview metrics
- [x] Admin user management (search, view, suspend/reactivate)
- [x] Admin volunteer management (search/filter, view profiles incl. NID, revoke/restore, view wallets read-only)
- [x] Admin order management (filter, view, update status)
- [x] Admin post moderation + report queue
- [x] Admin area management
- [x] Admin read-only ledger (Transactions tab)
- [x] Homepage sidebars (platform totals, top volunteers this month, volunteers to discover, viewer's own summary)

**Key considerations:**

- Aggregates are computed from `FinancialTransaction` and related tables, not cached counters
- Individual donor identities are kept out of the transparency overview. The public donations page (`/donations`) shows donor names and amounts on purpose (PRD §10, §41)

---

## Stage 9 — Polish & Security Pass

**Goal:** Harden the system for the security and integrity requirements in §39–40 before calling the MVP done.

**Deliverables:**

- [x] Audit logs for admin actions: every admin write (suspend, revoke, post status / take down, reports, areas, categories, products, order status, fund donations) writes an `AdminAuditLog` row in the same transaction; the table is append only (DB trigger) and shown in the admin panel's Audit Log tab
- [x] Duplicate-payment prevention: `Idempotency-Key` required on top up, donations, transfers, checkout and fund donations (PRD D22)
- [x] File upload validation: JPEG, PNG, GIF or WebP only, checked by magic bytes (the declared MIME type is not trusted), 5 MB, per-route file counts; the frontend pickers check the type too
- [x] NID never appears in any public or list response (admin volunteer list only)
- [x] Every multi-step financial operation wrapped in a DB transaction
- [ ] End-to-end test of the full MVP success flow (PRD §43). Each step is covered by its own tests, but no single test runs the whole chain: register → post → top up → donate → assign → wallet → purchase → deliver → profit → fund → public overview

**Open items found while updating the docs:**

- [x] Public donations page shows donor names and amounts (`GET /api/donations`, `/donations`). Kept on purpose, so the community can see who gives; PRD §10 and §41 now say so. An "anonymous" option stays in Later
- [x] CAPTCHA on sign in and sign up (see Stage 1)
- [x] `Schema.mmd` brought up to date with `schema.prisma` (all 26 models). `Schema.png` still shows the old diagram and needs exporting again
- [x] Reconciliation check and tests for the wallet/fund services (from Stage 4)
- [x] `JWT_SECRET` is required (32+ characters); the server fails at startup without it
- [x] Rate limiting on auth and money-moving routes (`rateLimit.middleware.js`; in-memory, so per process. Set `TRUST_PROXY` when deployed behind a proxy)
- [x] Update `Architecture.md` to match the code (R2, the wallet/fund services, the split RBAC middleware, the real folder layout)
- [x] Sessions: the login token is an httpOnly cookie backed by a `Session` row, so sign out, sign out everywhere, suspension and password resets revoke it on the server. Changes need an `X-Requested-With` header (CSRF)
- [x] Security headers with `helmet` (HSTS, nosniff, frame denial, strict CSP)
- [x] R2 free tier guard: usage read from Cloudflare's analytics API every 15 minutes; email at `R2_WARN_PERCENT` (80%), uploads refused with a 503 at `R2_BLOCK_PERCENT` (90%) of storage or Class A operations. Image reads from the public bucket can't be stopped by the server, so they only trigger an email
- [x] Forgot password flow (see Stage 1)

**Key considerations:**

- This stage is the final gate before considering the MVP complete — the §43 flow is the acceptance test

---

## Later (post-MVP)

- Real payment gateway (SSLCommerz) for wallet top ups and online checkout, using the existing `payment.services.js` seam
- Refresh tokens (server-side logout is done through sessions)
- Anonymous donations
- More than one volunteer per rescue
