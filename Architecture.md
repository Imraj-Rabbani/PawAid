# PawAid — Architecture

**Last updated:** 2026-10-20. This describes the code as built. For product rules see `PRD.md`; for build status see `Tasks.md`.

---

## 1. High-Level Architecture

PawAid is a **PERN** app (PostgreSQL, Express, React, Node.js): a React single-page app talking to an Express REST API, which stores everything in PostgreSQL through Prisma and stores images in Cloudflare R2.

```text
┌──────────────────────────┐
│   React SPA (Vite)       │  React Router, Tailwind, axios
│   localhost:5173         │  user + cart in localStorage
└────────────┬─────────────┘
             │ REST / JSON under /api
             │ JWT in an httpOnly cookie (+ X-Requested-With)
             │ Idempotency-Key on money-moving requests
┌────────────▼─────────────┐
│  Express 5 API           │  localhost:3000
│  ┌────────────────────┐  │
│  │ Middleware         │  │  auth, admin, active volunteer,
│  │                    │  │  idempotency, upload (multer)
│  ├────────────────────┤  │
│  │ Modules            │  │  one controller per feature
│  ├────────────────────┤  │
│  │ Services           │  │  wallet, fund, payment, upload
│  └────────────────────┘  │
└──────┬─────────────┬─────┘
       │ Prisma 7    │ S3 API
       │ (pg adapter)│
┌──────▼──────────┐ ┌▼───────────────────────┐
│ PostgreSQL      │ │ Cloudflare R2          │
│ app data +      │ │ post / update / expense│
│ financial ledger│ │ / product / profile    │
└─────────────────┘ │ images                 │
                    └────────────────────────┘
```

There is no background worker or message queue. The one scheduled job (clearing expired idempotency keys) runs on a timer inside the API process.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Vite |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) |
| HTTP client | axios |
| Backend | Node.js, Express 5, run with `tsx` + `nodemon` in dev |
| Database | PostgreSQL |
| ORM | Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`, `relationJoins` preview) |
| Auth | JWT (`jsonwebtoken`), bcrypt (`bcryptjs`) |
| Validation | Zod 4 |
| File uploads | multer (memory storage) → Cloudflare R2 via `@aws-sdk/client-s3` |
| Payments | Simulated (wallet top up, cash on delivery); SSLCommerz-ready seam in `payment.services.js` |
| Monorepo tooling | Root `package.json` with `concurrently` |

---

## 3. Folder Structure

```text
PawAid/
├── package.json                 # npm run dev → backend + frontend together
├── PRD.md  Tasks.md  Architecture.md
├── Schema.mmd  Schema.png       # ER diagram (schema.prisma is the source of truth)
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/          # one folder per migration
│   ├── prisma7.config.ts        # Prisma CLI config (schema + migrations path, DATABASE_URL)
│   ├── tests/                   # empty — no tests yet
│   └── src/
│       ├── server.js            # Express app, CORS, JSON, /api router, error handler, key cleanup timer
│       ├── db.js                # PrismaClient on the pg adapter
│       ├── config/env.js        # reads .env, with defaults
│       ├── generated/prisma/    # Prisma client output (generated, don't edit)
│       ├── routes/index.js      # every route, with its middleware chain
│       ├── middleware/
│       │   ├── auth.middleware.js         # requireAuth, optionalAuth
│       │   ├── admin.middleware.js        # requireAdmin
│       │   ├── volunteer.middleware.js    # requireActiveVolunteer
│       │   ├── idempotency.middleware.js  # requireIdempotencyKey, cleanupIdempotencyKeys
│       │   ├── upload.middleware.js       # multer + magic-byte check: JPEG/PNG/GIF/WebP, 5 MB
│       │   └── validate.middleware.js     # validateBody(schema): Zod check of req.body
│       ├── schemas/             # Zod request-body schemas, one file per module (+ common.schemas.js)
│       ├── services/
│       │   ├── audit.services.js    # logAdminAction, changedFields
│       │   ├── wallet.services.js   # creditWallet, debitWallet
│       │   ├── fund.services.js     # PawAid Fund: creditFund, debitFund, refundFund
│       │   ├── payment.services.js  # simulated external provider (not wired in)
│       │   └── upload.services.js   # uploadToR2, deleteFromR2
│       └── modules/
│           ├── auth/          # register, login (controller + services + utils)
│           ├── user/          # own profile, profile picture
│           ├── volunteer/     # apply, directory, public profile, update
│           ├── rescue/        # areas, posts, feed, upvotes, assignment, progress, updates
│           ├── comment/
│           ├── report/
│           ├── donation/      # donations, PawAid Fund donations, refunds of held donations
│           ├── wallet/        # top up, balance, history, volunteer transfers
│           ├── expense/       # rescue expense documentation
│           ├── marketplace/   # public storefront
│           ├── order/         # checkout, buyer's orders
│           ├── home/          # homepage sidebar summary
│           ├── transparency/  # public financial overview
│           └── admin/         # everything under /api/admin
│
└── frontend/
    ├── public/                # logo, default avatar, icons
    └── src/
        ├── main.jsx           # BrowserRouter + CartProvider
        ├── App.jsx            # routes
        ├── services/
        │   ├── api.js         # axios instance, token interceptor, 401 handling
        │   └── idempotency.js # useIdempotencyKey, withIdempotencyKey
        ├── context/           # cart: CartProvider, cartContext, useCartSync
        ├── pages/             # one component per route
        └── components/
            ├── Navbar.jsx  Icon.jsx
            ├── admin/         # one component per admin tab + shared ui/utils
            ├── feed/          # post card, create/edit/donate/report modals, comments, updates, expenses
            ├── rescue/        # rescue details page pieces
            ├── home/          # homepage sidebars
            ├── profile/       # profile tabs (profile, wallet, donations, orders, rescues, address)
            ├── volunteer/     # donate card
            ├── marketplace/   # product card, quantity stepper, buy buttons
            └── transparency/  # PawAid Fund donate modal (admins)
```

Each backend module is a single `*.controller.js` (auth also has `services` and `utils`). Request bodies are validated with Zod before the controller runs (`validateBody` on the route, schemas in `src/schemas/`); controllers talk to Prisma directly and call the shared services for anything that moves money. There is no separate repository or service layer per module.

---

## 4. Backend

### 4.1 Request lifecycle

```text
request
  → cors (CORS_ORIGIN) → express.json()
  → /api router
      → requireAuth | optionalAuth          who is calling
      → requireAdmin | requireActiveVolunteer   may they do this
      → requireIdempotencyKey               money-moving routes only
      → upload.single / upload.array        multipart routes only
      → validateBody(schema)                routes that take a body: 400 or a parsed req.body
      → controller                          Prisma → JSON
  → error handler                           multer errors → 400, others → status or 500
```

`validateBody` answers a bad body with `400 { message: "Validation failed", errors }` (Zod's `flatten().fieldErrors`); otherwise it replaces `req.body` with the parsed data, so controllers only ever see trimmed, coerced values and the fields the schema lists. It runs after `requireIdempotencyKey`, so a rejected body releases the key. URL parameters (`:postId` and so on) are still checked in the controller, which answers a malformed id with a 404. Controllers mostly handle their own errors and return `{ message, data }`. The global error handler in `server.js` catches anything thrown past them and never leaks a 500's details.

### 4.2 Authentication and authorization

- **Sign up / sign in** return `{ user }` and set the JWT as an httpOnly `token` cookie, so page scripts (and XSS) can't read it. Passwords are hashed with bcrypt (10 rounds). The JWT holds `userId`, `email` and `sessionId`, and expires after `JWT_EXPIRY` (default 7 days). Each sign-in creates a `sessions` row, and `requireAuth` only accepts a token whose session still exists, so the server can revoke tokens: `POST /signout` deletes that session, `POST /signout/all` deletes all of the user's sessions, and suspending a user deletes theirs. There are no refresh tokens; `requireAuth` already reads the database on every request, so checking the session costs nothing extra. `requireAuth` also accepts `Authorization: Bearer` (scripts, tests).
- **CSRF:** `requireCsrfHeader` refuses any non-GET request that carries the cookie but not `X-Requested-With: XMLHttpRequest`. Another site can't add that header without passing CORS. Cookie flags come from `COOKIE_SECURE` and `COOKIE_SAME_SITE` (`none` when the frontend and API are on different sites).
- **`requireAuth`** verifies the token, loads the user, and rejects anyone whose status isn't `ACTIVE` with a **401**. The frontend clears its token on any 401, so a suspended user is signed out on their next request.
- **`optionalAuth`** is for public routes that show extra details to a signed-in viewer (e.g. whether they upvoted a post). A bad token just means "guest".
- **`requireAdmin`** checks `role === "ADMIN"`. It is applied to the whole `/api/admin` prefix with `router.use`.
- **`requireActiveVolunteer`** loads the caller's `VolunteerProfile` and requires `status === "ACTIVE"`. It checks the profile's status rather than the user's role, so revoking a volunteer takes effect on their next request. It puts the profile on `req.volunteer`.
- **Per-resource checks** happen in controllers: only the assigned volunteer can update a rescue, only the creator can edit a post, only the buyer or an admin can see an order, and so on.

### 4.3 API surface

All routes are under `/api` and defined in `src/routes/index.js`. Legend: 🔓 public · 👤 signed in · 🙋 active volunteer · 🛡️ admin · 🔑 needs `Idempotency-Key`.

| Area | Routes |
|---|---|
| Auth | `POST /signup` 🔓, `POST /signin` 🔓 |
| Users | `GET /profile/:userId` 👤 (contact details, wallet and NID only for the owner or an admin), `PUT /profile/update` 👤, `PUT /users/profile-picture` 👤 |
| Home & transparency | `GET /home/summary` 🔓, `GET /transparency` 🔓 |
| Areas | `GET /area` 🔓, `POST /add-area` 🛡️ |
| Rescue posts | `GET /rescue-post` 🔓 (feed, `?filter=open\|fundraising\|rescued`, cursor paging), `GET /rescue-post/mine` 👤, `POST /rescue-post` 👤 (≤5 images), `GET /rescue-post/:postId` 🔓, `PUT` / `DELETE /rescue-post/:postId` 👤 creator |
| Engagement | comments (`GET` 🔓, `POST` 👤, `DELETE /comments/:id` 👤), `POST`/`DELETE /rescue-post/:postId/upvote` 👤, `POST /rescue-post/:postId/report` 👤 |
| Rescue work | `POST /rescue-post/:postId/assign` 🙋, `PATCH /rescue-post/:postId/progress` 🙋, updates (`GET` 🔓, `POST` 🙋 ≤4 images), expenses (`GET` 🔓, `POST` 🙋, `DELETE /expenses/:id` 🙋) |
| Volunteers | `GET /volunteer` 🔓, `GET /volunteer/:id` 🔓, `POST /volunteer/apply` 👤, `GET`/`PUT /volunteer/profile` 👤/🙋 |
| Wallet | `GET /wallet/me` 👤, `GET /wallet/transactions` 👤, `POST /wallet/top-up` 👤🔑, `POST /wallet/transfer` 🙋🔑 |
| Donations | `GET /donations` 🔓, `GET /donations/me` 👤, `POST /donations/volunteer/:volunteerId` 👤🔑, `POST /donations/rescue-post/:postId` 👤🔑 |
| Marketplace | `GET /marketplace/products` 🔓, `GET /marketplace/products/:productId` 🔓, `GET /marketplace/categories` 🔓 |
| Orders | `GET /orders` 👤, `POST /orders` 👤🔑, `GET /orders/:orderId` 👤 |
| Admin | `/admin/stats`, `users`, `volunteers`, `posts`, `reports`, `areas`, `categories`, `products`, `orders`, `transactions` (read-only ledger), `POST /admin/fund/donations` 🔑 — all 🛡️ |

Static paths like `/rescue-post/mine` and `/volunteer/profile` are registered before their `/:id` siblings so they aren't parsed as ids.

**Pagination:** public and user-facing lists use cursor paging (`?cursor=<id>&limit=`, fetching one extra row to compute `nextCursor`). Admin tables use offset paging with page numbers.

### 4.4 Uploads

`upload.middleware.js` keeps files in memory (multer) and caps each file at 5 MB. It accepts JPEG, PNG, GIF and WebP only, decided by the file's magic bytes rather than the client's declared MIME type, and then overwrites `file.mimetype` with the detected type, so the R2 key extension and `ContentType` the controllers derive from it can be trusted. SVG is rejected because it can carry scripts. Each route sets its own file count. Controllers run their permission checks *before* uploading, so a rejected request never writes to R2, then call `uploadToR2(buffer, key, contentType)`, which returns the public URL that gets stored in the database. Keys are prefixed by kind: `rescue-posts/`, `rescue-updates/`, `rescue-expenses/`, `products/`, and so on.

---

## 5. Money Architecture

This is the part of the system that needs the most care. The rules come from PRD §31 and §40.

### 5.1 Ledger model

```text
                 ┌────────────────────────┐
  Payment ──────►│  FinancialTransaction  │◄────── Donation / Order / RescueFund
 (how it was     │  type, source,         │        (what it was for)
  paid, status)  │  destination, amount,  │
                 │  status, reference,    │
                 │  related user/volunteer│
                 │  /post/order           │
                 └───────────┬────────────┘
                             │ 1 : many
                 ┌───────────▼────────────┐
                 │   WalletTransaction    │  CREDIT / DEBIT, amount
                 └───────────┬────────────┘
                             │ many : 1
                 ┌───────────▼────────────┐
                 │  Wallet (one per user) │  balance
                 └────────────────────────┘
```

- **`FinancialTransaction`** is the ledger: one row per money movement. Types: `INCOME` (top up), `DONATION`, `TRANSFER`, `ORDER_PAYMENT`, `REFUND`, `MARKETPLACE_PROFIT`, `RESCUE_FUND_ALLOCATION` (`EXPENSE` is reserved).
- **`WalletTransaction`** records each wallet's side of a movement. A transfer has one ledger row and two wallet rows (a debit and a credit).
- **`Wallet.balance`** is kept for fast reads, but every change to it is written together with its `WalletTransaction` row.
- **`RescueFund`** is the PawAid Fund. It has a single row with a fixed id (`PAWAID_FUND_ID`, seeded by a migration) and tracks `total_available` (everything received) and `total_used` (everything given out).
- **Amounts** are whole taka stored as `Int`. There are no floats and no sub-units.

### 5.2 Rules every money flow follows

1. **One database transaction per flow.** The payment, donation/order, ledger row, wallet rows and any status change are all written inside a single `prisma.$transaction`. Slow, multi-row flows (checkout, order status, fund donations, post status with refunds) raise `maxWait`/`timeout`, because the database is remote.
2. **Balance checks happen in the same statement as the change.** `debitWallet` runs `updateMany where balance >= amount` and treats 0 rows updated as insufficient funds. `debitFund` does the same in raw SQL, because Prisma can't compare two columns in a `where`. Concurrent requests therefore can't spend the same money twice. Controllers also check up front, but only so they can return a clearer error message.
3. **Claiming and changing state is also a conditional update.** Examples: assigning a post (`where status = OPEN and assignedVolunteerId is null`), moving an order (`where status = <the status we read>`), and an admin changing a post (`where assignedVolunteerId = <what we read>`). The update locks the row, so a second request either waits for the first or fails cleanly.
4. **Fixed lock order.** Checkout and order cancellation lock products sorted by id, so two of them running at once can't deadlock.
5. **Nothing is edited after the fact.** Refunds and cancellations add new rows (`REFUND`, payment status `REFUNDED`/`FAILED`). They never delete or rewrite earlier ledger rows.
6. **The database enforces two invariants:** a donation has exactly one source (`donor_id` or `rescue_fund_id`), and the fund can never give out more than it has received (`0 <= total_used <= total_available`).

### 5.3 The flows

| Flow | Where | Ledger | Wallet / fund effect |
|---|---|---|---|
| Top up (simulated) | `wallet.controller` | `INCOME`, payment `OTHER`/`COMPLETED` | user wallet + |
| Donate to volunteer | `donation.controller` | `DONATION` | donor − / volunteer + |
| Donate to post, no volunteer | `donation.controller` | `DONATION` → `RESCUE_POST` | donor −; held on `post.donationReceived` |
| Donate to post with volunteer | `donation.controller` | `DONATION` → `VOLUNTEER` | donor − / volunteer + |
| Volunteer claims post | `rescue.controller` `assignPost` | `TRANSFER` `RESCUE_POST` → `VOLUNTEER` | volunteer + (everything held on the post) |
| Admin closes a post with no volunteer | `admin.controller` → `refundHeldDonations` | one `REFUND` per donation; payment → `REFUNDED` | donors + / fund `total_used` −; post held amount → 0 |
| Volunteer transfer | `wallet.controller` | `TRANSFER` | sender − / receiver + |
| Checkout, wallet | `order.controller` | `ORDER_PAYMENT` `COMPLETED` | buyer −; stock −; order `CONFIRMED` |
| Checkout, cash on delivery | `order.controller` | `ORDER_PAYMENT` `PENDING` | stock −; order `PENDING` |
| Order delivered | `admin.controller` | cash: payment and ledger → `COMPLETED`; plus `MARKETPLACE_PROFIT` | fund `total_available` + profit |
| Order cancelled | `admin.controller` | wallet: `REFUND`, payment `REFUNDED`; cash: payment `FAILED`, ledger `CANCELLED` | stock +; wallet buyer + |
| PawAid Fund donation | `donation.controller` `donateFromFund` | `RESCUE_FUND_ALLOCATION` + a `Donation` with the fund as donor | fund `total_used` +; volunteer + or held on the post |

Profit for an order is `Σ max(unitPrice − unitCost, 0) × quantity`, using the price and cost copied onto each `OrderItem` at checkout. Profit is posted only when an order moves to `DELIVERED`, which can happen only once.

**Refunded donations** stay in the database. Every total excludes them with the shared `NOT_REFUNDED` filter (`payment.status != REFUNDED`), exported from `donation.controller.js`. It works on both `Donation` and `FinancialTransaction`.

### 5.4 Duplicate-payment protection

`requireIdempotencyKey` sits on every route that moves money. The client generates one key (`crypto.randomUUID()`) per payment attempt and sends it in the `Idempotency-Key` header on every retry.

```text
INSERT IdempotencyKey (userId, key, endpoint, sha256(body))   unique (userId, key)
  ├─ inserted        → run the handler; on 2xx save status+body, on error delete the key
  └─ already exists  → expired?            → delete it and try again
                       other endpoint/body? → 422
                       still running?      → 409
                       finished?           → replay the saved response (Idempotent-Replayed: true)
```

The insert into the unique `(userId, key)` index acts as the lock. Only successful responses are saved: the money-moving handlers run in a database transaction, so a failed attempt changed nothing and can safely run again. Keys live for 24 hours, and `server.js` deletes expired ones every hour.

### 5.5 Payments

Money enters the platform only through the simulated wallet top up (`DUMMY_TOP_UP`). Checkout supports `CASH` and `WALLET`. `payment.services.js` contains a simulated external provider (`chargeExternal` for bKash, Nagad and card) behind an SSLCommerz-shaped interface, but nothing calls it yet. A real gateway would confirm top ups and orders from its callback instead of immediately.

---

### 5.6 Admin audit log

Every admin write calls `logAdminAction(tx, adminId, { action, targetType, targetId, summary, details })` inside the same `prisma.$transaction` as the change, so the change and its `AdminAuditLog` row are saved together or not at all. A rejected request (validation, 404, 409, fund shortfall) writes nothing.

- `summary` is the readable line shown in the admin panel; `details` holds before/after values (`{ from, to }`, or `{ changes: { field: { from, to } } }` for products).
- `targetId` has no foreign key, so history survives the target (a deleted area keeps its entries).
- The migration adds a trigger that rejects `UPDATE` and `DELETE` on `admin_audit_logs`, and there is no API to edit or remove entries.
- `GET /admin/audit-logs` (filters: `action`, `targetType`, `targetId`, `adminId`, `search`) feeds the Audit Log tab.

---

## 6. Data Model

23 Prisma models, grouped:

| Group | Models |
|---|---|
| People | `User` (role `USER`/`VOLUNTEER`/`ADMIN`, status), `VolunteerProfile` (area, unique NID, status), `RescueArea` |
| Community | `RescuePost`, `RescuePostImage`, `RescueUpdate`, `RescueUpdateImage`, `Comment`, `PostUpvote` (unique per user + post), `PostReport` |
| Money | `Wallet` (one per user), `WalletTransaction`, `Payment`, `FinancialTransaction`, `Donation`, `RescueFund`, `RescueExpense` |
| Marketplace | `ProductCategory`, `Product`, `Order`, `OrderItem` |
| Infrastructure | `IdempotencyKey`, `AdminAuditLog` (append only) |

Conventions:
- UUID primary keys (`@db.Uuid`); snake_case table and column names through `@@map` / `@map`.
- Posts are never hard-deleted once they have money attached. An admin take down sets status `CANCELLED`; creators can delete only posts with no donations.
- Products are deactivated, never deleted, because orders reference them.
- Snapshots: `OrderItem.unitPrice`/`unitCost` and the order's delivery name, phone and address are copied at checkout, so later edits don't rewrite history.

Schema changes go through Prisma migrations in `backend/prisma/migrations`. Some migrations contain hand-written SQL for data backfills, CHECK constraints and the fund's seed row.

---

## 7. Frontend

### 7.1 Routing

| Route | Page |
|---|---|
| `/` | Homepage: rescue feed with filter tabs, plus sidebars |
| `/rescue/:postId` | Rescue details |
| `/profile/:userId` | Profile with tabs (profile, wallet, donations, orders, rescues, address) |
| `/volunteers`, `/volunteers/:volunteerId` | Volunteer directory and public profile |
| `/donations` | Public donation list |
| `/transparency` | Financial overview (admins can donate from the PawAid Fund here) |
| `/marketplace`, `/marketplace/:productId` | Storefront and product page |
| `/cart`, `/checkout`, `/orders/:orderId` | Cart, checkout, order details |
| `/admin` | Admin dashboard, tabs selected by query string |
| `/signin`, `/signup` | Auth |

### 7.2 State and data fetching

- **No global data store.** Pages fetch with the shared axios instance in `useEffect`, using an `ignore` flag to drop stale responses, and keep results in local state.
- **Session:** the login cookie is httpOnly, so the frontend never sees the token. axios sends it with `withCredentials` and adds `X-Requested-With`. `user` lives in `localStorage` for display only; the response interceptor clears it on a 401, which signs out suspended users and expired sessions. `updateStoredUser` keeps the cached user current after profile edits.
- **Cart:** `CartProvider` stores `{ ownerId, items }` in `localStorage`. A guest cart is adopted on sign in, and another user's cart is never shown. `useCartSync` re-checks prices and stock against `GET /marketplace/products?ids=` once per visit, and again when checkout returns `CART_CHANGED`.
- **Payments:** components that send money use `useIdempotencyKey()` for a key that stays the same across retries, and call `renew()` after a success.
- **Role checks in the UI are cosmetic** (hiding admin buttons, etc.). The API enforces every permission itself.

### 7.3 Styling

Tailwind CSS 4. Newer screens (homepage, marketplace, transparency, admin) use the theme tokens (`bg-primary`, `text-on-surface`, `surface-container-*`). Some older screens (profile, volunteer profile) still use raw Tailwind colors such as `blue-600`. Icons go through `components/Icon.jsx`.

---

## 8. Configuration and Running Locally

`backend/.env`:

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | — (required) |
| `JWT_SECRET` | JWT signing key, at least 32 random characters | none: the server refuses to start without it |
| `JWT_EXPIRY` | Token lifetime | `7d` |
| `PORT` | API port | `3000` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Cloudflare R2 bucket for images | — |

The frontend's API base URL is hard-coded to `http://localhost:3000/api` in `frontend/src/services/api.js`.

```bash
npm run install:all          # root, backend and frontend dependencies
cd backend
npx prisma migrate deploy    # apply migrations
npx prisma generate          # build the client into src/generated/prisma
cd ..
npm run dev                  # API on :3000 and Vite on :5173, side by side
```

---

## 9. Known Gaps


- **The frontend API URL is hard-coded.** It should come from a Vite env variable (`VITE_API_URL`) before deploying.
