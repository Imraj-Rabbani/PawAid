# PawAid — Architecture

## 1. High-Level Architecture

PawAid follows a standard **PERN** (PostgreSQL, Express, React, Node.js) three-tier architecture.

```text
┌─────────────────────┐
│   React Frontend    │
│  (Web Client, SPA)  │
└──────────┬──────────┘
           │ REST API (JSON, JWT auth)
┌──────────▼───────────┐
│  Express Backend     │
│  ┌─────────────────┐ │
│  │  Middleware     │ │  auth, RBAC, validation, upload
│  ├─────────────────┤ │
│  │  Modules        │ │  feature-based controllers/services
│  ├─────────────────┤ │
│  │  Core Services  │ │  ledger, payment, money utils
│  └─────────────────┘ │
└──────────┬───────────┘
           │ Prisma ORM
┌──────────▼────────────┐      ┌────────────────────────┐
│   PostgreSQL          │      │   Cloudinary           │
│  (relational data,    │      │  (image storage:       │
│   financial ledger)   │      │   rescue post images,  │
└───────────────────────┘      │   profile pics, NID)   │
                               └────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Styling | Tailwind CSS |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT |
| Image storage | Cloudinary |
| Validation | Zod |
| Payment | Simulated provider (SSLCommerz-ready abstraction) |

---

## 3. Folder Structure

```text
pawaid/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   └── env.js
│   │   │
│   │   ├── models/                 # Prisma schema (or per-entity model files)
│   │   │   └── schema.prisma
│   │   │
│   │   ├── modules/                # feature-based
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── volunteers/
│   │   │   ├── rescuePosts/
│   │   │   ├── donations/
│   │   │   ├── wallet/             # balance + transfers
│   │   │   ├── marketplace/        # products, categories, orders
│   │   │   ├── rescueFund/         # allocation, public overview
│   │   │   └── admin/              # moderation, reports, dashboard
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js
│   │   │   ├── rbac.middleware.js
│   │   │   ├── upload.middleware.js   # Cloudinary upload handling
│   │   │   └── errorHandler.js
│   │   │
│   │   ├── services/
│   │   │   ├── payment.service.js
│   │   │   ├── ledger.service.js
│   │   │   └── money.util.js       # ×100 / ÷100 conversion helpers
│   │   │
│   │   ├── routes/
│   │   │   └── index.js
│   │   │
│   │   └── app.js
│   │
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   │
│   ├── tests/
│   ├── .env
│   └── server.js
│
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       │   ├── common/
│       │   ├── rescuePost/
│       │   ├── volunteer/
│       │   ├── wallet/
│       │   └── marketplace/
│       ├── pages/
│       │   ├── Community/
│       │   ├── VolunteerProfile/
│       │   ├── Marketplace/
│       │   ├── Wallet/
│       │   ├── Admin/
│       │   └── FinancialOverview/
│       ├── context/
│       ├── hooks/
│       └── App.jsx
│
└── README.md
```