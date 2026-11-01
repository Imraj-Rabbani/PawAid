# PawAid

PawAid is a web platform for animal rescue. People report animals that need help, volunteers take on rescues in their area, and donors fund the work. Volunteers spend donated money only in PawAid's marketplace of rescue supplies, and the marketplace's profit goes back into rescues through the PawAid Fund. A public transparency page shows where the money went.

It is a portfolio project built on the PERN stack (PostgreSQL, Express, React, Node.js). Payments are simulated.

## Features

- **Rescue community:** a feed of rescue posts with photos, comments, upvotes and reports, plus a ranked "For You" feed. Posts move from Open to In Progress to Rescued.
- **Volunteers:** users apply to volunteer and pick a rescue area. Volunteers claim posts, post progress updates, and record expenses with receipts.
- **Donations and wallets:** every user has a wallet. Users top it up, then donate to a rescue post or straight to a volunteer. Volunteers can send funds to other volunteers.
- **Marketplace:** a shop for rescue supplies with a cart, checkout, and wallet or cash-on-delivery payment.
- **PawAid Fund:** profit from delivered orders goes into a fund, which admins give out to volunteers and rescue posts.
- **Transparency:** a public overview of donations, marketplace revenue and profit, the fund, and rescue expenses.
- **Admin dashboard:** manage users, volunteers, areas, posts, reports, products and orders, and read the transaction ledger and the admin audit log.
- **Accounts and security:** email/password and Google sign-in, password reset by email, Cloudflare Turnstile CAPTCHA, httpOnly cookie sessions that the server can revoke, CSRF protection, rate limits, and idempotency keys on every request that moves money.

## Tech stack

| Layer    | Technology                                        |
| -------- | ------------------------------------------------- |
| Frontend | React, Vite, Tailwind                             |
| Backend  | Node.js, Express , Zod                           |
| Database | PostgreSQL with Prisma 7                          |
| Storage  | Cloudflare R2 for images                          |
| Email    | Resend                                            |
| Tests    | Vitest and supertest against an embedded Postgres |

## Project structure

```text
PawAid/
├── package.json        # runs backend and frontend together
├── PRD.md              # product requirements
├── Architecture.md     # how the system is built
├── Tasks.md            # build plan and status
├── Schema.mmd / .png   # ER diagram
├── backend/            # Express API, Prisma schema and migrations, tests
└── frontend/           # React single-page app
```

## Getting started

### Prerequisites

- Node.js 20.19 or later (required by Vite 8)
- A PostgreSQL database

### 1. Install dependencies

```bash
npm run install:all
```

This installs the root, backend and frontend dependencies.

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

At minimum, set `DATABASE_URL` and `JWT_SECRET` in `backend/.env`. Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The other settings are optional for local development:

| Feature        | Variables                                                                                                | Without them                  |
| -------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Google sign-in | `GOOGLE_CLIENT_ID` (backend), `VITE_GOOGLE_CLIENT_ID` (frontend)                                     | Google sign-in is unavailable |
| CAPTCHA        | `TURNSTILE_SECRET_KEY` (backend), `VITE_TURNSTILE_SITE_KEY` (frontend)                               | CAPTCHA is off                |
| Image uploads  | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Uploads fail                  |
| Email          | `RESEND_API_KEY`, `EMAIL_FROM`, `ALERT_EMAIL`                                                      | No emails are sent            |
| R2 usage guard | `CLOUDFLARE_API_TOKEN`                                                                                 | Guard is off                  |

Each variable is explained in the `.env.example` files.

### 3. Set up the database

```bash
cd backend
npx prisma migrate deploy --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
cd ..
```

### 4. Run the app

```bash
npm run dev
```

* [ ] The API runs on http://localhost:3000 and the frontend on http://localhost:5173. To run only one of them, use `npm run dev:backend` or `npm run dev:frontend`

### Creating an admin

New accounts get the `USER` role. To make an account an admin, sign up and then update it in the database:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';
```

## Testing

```bash
cd backend
npm test
```

The tests start their own embedded PostgreSQL, apply the migrations and wipe the data between tests, so they never touch your real database. Google, Resend and Cloudflare are faked.

To check that a real database's wallet balances and fund totals match its ledger (read-only):

```bash
cd backend
npm run check:ledger
```

## Documentation

- [PRD.md](PRD.md): product requirements and business rules
- [Architecture.md](Architecture.md): system design, the API, the money ledger, and known gaps
- [Tasks.md](Tasks.md): build plan and progress
- [Schema.png](Schema.png): database diagram

## Known limitations

- [ ] Payments are simulated. Wallet top-ups are dummy transactions, and online payment methods are switched off.
- [ ] The frontend's API URL is hard-coded to `http://localhost:3000/api` in `frontend/src/services/api.js`.
- [ ] Rate limits and the R2 upload pause are kept in memory, so they apply to a single server process.
