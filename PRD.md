# PawAid — Product Requirements Document

**Version:** 1.1  
**Project Type:** Portfolio Project  
**Project Name:** PawAid

---

# 1. Product Overview

PawAid is a web-based animal rescue platform designed to connect:

- Volunteers
- General users/donors

The platform allows volunteers and users to report animals requiring rescue, raise donations for rescue activities, and use donated funds to purchase rescue-related products through PawAid's internal marketplace.

PawAid combines four primary systems:

1. **Animal Rescue Community**
2. **Volunteer Management**
3. **Donation & Wallet System**
4. **Rescue Marketplace**

The platform also provides financial transparency. Users can see aggregated information about donations, marketplace revenue, marketplace profit, the PawAid Fund, volunteer balances, and documented rescue expenses.

---

# 2. Problem Statement

Stray and abandoned animals often require immediate assistance, but rescue efforts are fragmented.

Potential volunteers may not know:

- Where animals need help
- Who is currently rescuing animals in their area
- How they can financially support a rescue
- How donated money is being used

Donors also have limited visibility into how their money contributes to rescue activities.

PawAid aims to provide a centralized platform where rescue requests, volunteers, donations, rescue purchases, and financial information can be connected.

---

# 3. Product Goals

## 3.1 Primary Goals

- Connect rescue volunteers with animals requiring help.
- Allow users to create rescue requests.
- Allow volunteers to select a rescue area.
- Allow users to donate to rescue posts.
- Allow users to donate directly to volunteers.
- Give every user a wallet; a volunteer's wallet holds restricted rescue funds.
- Allow volunteers to spend their wallet balance only through the PawAid marketplace.
- Allow volunteers to transfer wallet funds to other volunteers.
- Provide a marketplace for rescue-related products.
- Allocate marketplace profit toward rescue activities through the PawAid Fund.
- Let volunteers show followers how a rescue is going and what its money was spent on.
- Provide financial transparency to users.
- Allow multiple rescue volunteers to operate on the platform.

## 3.2 Transparency Goal

Users should be able to understand the flow of money at an aggregated level.

```text
Wallet Top Ups
      ↓
Donations
      ↓
Volunteer Wallets
      ↓
Marketplace Purchases
      ↓
Rescue Products  →  Documented Rescue Expenses
```

And separately:

```text
Marketplace Sales (delivered orders)
      ↓
Product Cost
      ↓
Marketplace Profit
      ↓
PawAid Fund
      ↓
Donations to Volunteers / Rescue Posts
```

---

# 4. User Roles

PawAid has three primary user roles: `USER`, `VOLUNTEER`, `ADMIN`.

## 4.1 Admin

The administrator manages the rescue platform.

Admin capabilities include:

- Manage users (view, suspend, reactivate)
- Manage volunteers (revoke, restore, view NID and wallet read-only)
- Manage rescue areas (add, rename, delete unused areas)
- Manage community posts (change status, take down)
- Review reported posts
- Manage marketplace products and categories
- Manage orders
- View donations
- View volunteer wallets
- View the full financial transaction ledger (read-only)
- Donate from the PawAid Fund to volunteers or rescue posts
- View financial reports

---

## 4.2 Volunteer

A volunteer is a registered user who participates in animal rescue activities.

Volunteers can:

- Select and change their rescue area
- Update their profile
- Create rescue posts
- Assign themselves to rescue posts
- Move their rescues through In Progress → Rescued
- Post rescue updates (notes and photos)
- Record rescue expenses with a receipt
- Receive donations
- Maintain a rescue wallet
- Purchase rescue products using wallet funds
- Transfer wallet funds to another volunteer
- Purchase marketplace products with cash on delivery
- View their transaction history

Volunteer status can be revoked by the Admin.

A revoked volunteer can no longer perform volunteer-specific actions. Revocation changes the volunteer *profile status*, not the user's role. Every volunteer-only route checks that the profile is `ACTIVE`, so revocation takes effect on the next request.

---

## 4.3 Normal User

Normal users can:

- Register and create an account
- Browse rescue posts
- Create rescue posts
- Top up their wallet (simulated)
- Donate to rescue posts
- Donate directly to volunteers
- Browse volunteers
- Browse volunteers by rescue area
- View volunteer donation information
- Comment on posts
- Upvote posts
- Report posts
- Purchase products from the marketplace (cash on delivery or wallet)
- View marketplace financial information

A normal user can later apply to become a volunteer.

---

# 5. User Registration

## 5.1 Normal User Registration

Minimum information:

- Name
- Email (stored lower-case, unique)
- Password (at least 8 characters, hashed with bcrypt)

A wallet with a zero balance is created for every user at sign up.

Additional account information (phone, address, profile picture) can be added from the profile page after registration.

Sign up and email/password sign in include a "verify you are human" check (Cloudflare Turnstile).

Users can also sign up and sign in with Google. The Google account's email must be verified; if an email/password account already uses that email, the Google account is linked to it rather than creating a second account.

---

## 5.1.1 Forgotten Passwords

A user who forgets their password asks for a reset link from the sign in page:

- The reply is the same whether or not the email has an account, so the form can't be used to find out who is registered.
- The link is emailed, works once, and expires after 30 minutes. Asking again replaces the earlier link.
- Setting the new password signs the account out on every device.
- Suspended accounts don't get a link.
- Accounts created through Google sign-in can use it to add a password.

---

## 5.2 Volunteer Application

A normal user can apply to become a volunteer.

Volunteer information collected:

- Rescue area (required)
- NID (required, unique across volunteers)
- Phone
- Address
- Personal description
- Name, email and profile picture come from the user's account

The rescue area is selected from a predefined dropdown.

Volunteer approval is not required. The profile is created with status `ACTIVE` and the user's role becomes `VOLUNTEER` in a single transaction.

Only users with the `USER` role can apply. Admins cannot apply.

The Admin can revoke the volunteer role at any time.

---

# 6. Rescue Areas

Rescue areas are predefined by the Admin.

Example:

```text
Dhaka
├── Dhanmondi
├── Mirpur
├── Uttara
├── Mohammadpur
└── Farmgate
```


A volunteer has one active rescue area and can change it.

Users can browse/filter volunteers by rescue area.

Admins can add and rename areas. An area can only be deleted if no volunteer or rescue post uses it.

---

# 7. Volunteer Profile

Every active volunteer has a public profile.

The profile contains:

- Name
- Profile picture
- Description
- Rescue area
- Volunteer status
- Member since date
- Total donations received and donation count
- Total amount received into and spent from the wallet
- Current available wallet balance
- Recent wallet history (amounts, types and related rescue posts — **never who the money came from**)
- Rescues handled and rescues resolved
- The rescue posts they are handling

Example:

```text
--------------------------------
          Volunteer
        [Profile Image]

        John Doe

        Rescue Area:
        Mirpur, Dhaka

        About:
        Animal rescuer...

        Donations Received
             ৳50,000

        Amount Spent
             ৳32,000

        Available Balance
             ৳18,000
--------------------------------
```

Users can donate directly to the volunteer from their profile.

Revoked or suspended volunteers do not appear publicly.

NID, phone, address and email are never included in the public profile or volunteer directory.

---

# 8. Community / Rescue Posts

The Community section is the central rescue coordination area. It is the homepage feed.

Both volunteers and normal users can create rescue posts.

## 8.1 Rescue Post

A rescue post contains:

- Title (3–150 characters)
- Description (at least 10 characters)
- Animal images (up to 5)
- Rescue area
- Creator
- Creation date
- Donation target (optional; `0` means the post is not fundraising)
- Donation amount received
- Rescue status
- Assigned volunteer
- Comments, upvotes, updates and expenses (with counts)

Example:

```text
Injured Dog Near Mirpur 10

[Images]

This dog appears to have an injured leg
and requires medical treatment.

Donation Target: ৳10,000
Received: ৳6,500

Status: Awaiting Volunteer
```

The homepage feed is paginated (cursor-based) and has tabs:

- **For You** (default) — ranked, see below
- **Latest** — every rescue, newest first
- **Needs a Volunteer** — open, unassigned posts, newest first
- **Fundraising** — posts with a target that are still active, newest first
- **Rescued** — resolved posts, newest first

**For You ranking.** The aim is to put each rescue in front of the people most able to help while help still matters, not to maximise engagement. Each post's score is

```
status weight × area boost × (1 + funding boost + ln(1 + upvotes + 2·comments + 3·donors))
─────────────────────────────────────────────────────────────────────────────────────────
                               (age in hours + 2) ^ 1.5
```

- **Status weight:** open with no volunteer 3, assigned / in progress 1.5, rescued 0.5, closed 0.25.
- **Area boost:** ×2 for a post in the viewer's area: the area they chose on their profile, otherwise their volunteer area. Guests and users without one get no boost and are invited to choose an area.
- **Funding boost:** +0.5 while a post is still raising money, +1 once it is 60% or more of the way to its target.
- **Engagement** is on a log scale so a popular post can't hold the top spot forever. Donors are people, not the PawAid Fund, and refunded donations don't count.
- **Age:** an open post with no volunteer stops sinking after 24 hours, so it isn't buried while it still needs someone.
- Taken down posts, posts by suspended users, and finished rescues older than 30 days are left out.

The cursor fixes "now" at the first page, so later pages continue the same order. A user's area is private: other users never see it on their profile.

Every rescue post also has its own details page (`/rescue/:postId`) with a photo gallery, donation card, volunteer card, updates, expenses and comments. The details page shows how many people donated, never who.

## 8.2 Editing and Deleting a Post

- A creator can edit or delete their post only while it is `OPEN` and no volunteer has taken it.
- The donation target cannot be lowered below the amount already raised.
- A post that has received any donation cannot be deleted, so its financial records stay intact (§26). It can only be taken down by an admin.

## 8.3 Post Upvotes

Signed-in users can upvote a post once and remove their upvote. The feed shows the upvote count and whether the viewer has upvoted.

## 8.4 Rescue Updates

The volunteer handling a rescue can post updates for its followers: a note (up to 1,000 characters), up to 4 photos, or both. Updates can be posted while the rescue is Assigned, In Progress or Rescued, so the volunteer can keep sharing recovery news after the rescue. Anyone can read them, newest first.

---

# 9. Rescue Assignment

A rescue post created by a normal user may initially have no assigned volunteer.

Donations made to that post are held on the post as **unassigned rescue funds**.

```text
User creates rescue post
        ↓
Donations received
        ↓
Unassigned Rescue Funds (held on the post)
        ↓
Volunteer assigns themselves
        ↓
Funds transferred to Volunteer Wallet
```

Once a volunteer assigns themselves to the rescue:

- The rescue post becomes assigned.
- The associated donation balance is transferred to that volunteer's wallet, in the same database transaction as the assignment.
- The volunteer becomes responsible for the rescue activity.

Only one volunteer can be assigned to a rescue post. Only an `OPEN`, unassigned post can be claimed; if two volunteers claim at once, only one succeeds.

## 9.1 Rescue Status Lifecycle

The status values are:

| Status | Meaning (UI label) | Who sets it |
| --- | --- | --- |
| `OPEN` | Awaiting volunteer | Default on creation |
| `ASSIGNED` | A volunteer took it | Volunteer self-assignment |
| `IN_PROGRESS` | Rescue under way | Assigned volunteer |
| `RESOLVED` | Rescued | Assigned volunteer, with an optional closing note and photo |
| `CLOSED` | Closed without further activity | Admin |
| `CANCELLED` | Taken down by an admin | Admin |

The assigned volunteer can move a rescue forward only: `ASSIGNED → IN_PROGRESS → RESOLVED` (or `ASSIGNED → RESOLVED`). Admins can set any status, except that `ASSIGNED`/`IN_PROGRESS` require a volunteer and a post with a volunteer cannot be reopened.

---

# 10. Donations

PawAid supports one-time donations.

All donations are paid from the donor's PawAid wallet. Money enters the platform only through wallet top ups (simulated for now, §23). This keeps one payment path for every donation and makes the ledger simple to reconcile.

There are two primary donation destinations.

## 10.1 Donation to Rescue Post

Users can donate to a rescue post that has a donation target and is `OPEN`, `ASSIGNED` or `IN_PROGRESS`.

```text
Donor Wallet
 ↓
Rescue Post
 ↓
Unassigned Rescue Balance
 ↓
Volunteer Assignment
 ↓
Volunteer Wallet
```

If the rescue post has already been assigned to a volunteer:

```text
Donor Wallet
 ↓
Rescue Post
 ↓
Assigned Volunteer Wallet
```

The post's `donationReceived` total goes up in both cases.

---

## 10.2 Donation to Volunteer

Users can donate directly from an active volunteer's public profile.

```text
Donor Wallet
 ↓
Volunteer Profile
 ↓
Volunteer Wallet
```

The volunteer's total donations received are visible publicly.

---

# 11. Donation Rules

- Donations are one-time.
- Donations are paid from the donor's wallet and fail if the balance is too low.
- Donor account information is stored.
- Donations to unassigned rescue posts remain on the post until a volunteer takes responsibility.
- Donations assigned to a volunteer become part of the volunteer's wallet.
- A user cannot donate to themselves, to their own rescue post, or to a rescue they are handling.
- A post cannot receive donations if its assigned volunteer has been revoked.
- Donation amounts are whole taka, between ৳1 and ৳1,000,000.
- Donation money cannot be withdrawn as cash.
- Donations cannot be refunded, with one exception: if an admin moves a rescue post that has no volunteer out of `OPEN` (take down, Closed or Resolved), nobody can claim it any more, so every donation it is holding is refunded automatically. A user's donation goes back to their wallet; a PawAid Fund donation goes back to the fund. Refunded donations stay in the history, marked refunded, and no longer count towards any total.
- Once a volunteer has the rescue, its donations are in their wallet and are not refunded, even if the post is later taken down.
- Volunteers can use wallet funds only within the PawAid marketplace.
- Volunteers can transfer wallet funds to other volunteers.

Users can see their own donation history (made, and for volunteers, received) on their profile. A public donations page lists recent donations across the platform, showing each donor's name, the amount, and the rescue or volunteer it went to. This is deliberate: naming donors lets the community see who is giving and check that money reached the rescue. Donors can't hide their name for now; an "anonymous" option is planned for after the MVP. PawAid Fund donations are listed as from the PawAid Fund, and refunded donations are shown struck through.

---

# 12. Wallet

Every user has a wallet, created at sign up. Normal users need a wallet because donations are paid from it. A volunteer's wallet also holds the restricted rescue funds they receive.

Example (volunteer):

```text
Volunteer Wallet

Current Balance:       ৳20,000

Total In:              ৳35,000   (donations, transfers, PawAid Fund, refunds)
Total Out:             ৳15,000   (marketplace spending, transfers sent)
```

Each user can see their own wallet balance and full paginated history, including where the money came from and went to.

## 12.1 Wallet Restrictions

Wallet funds:

- Cannot be withdrawn as cash.
- Cannot be transferred to external payment accounts.
- Can be used by any user to donate.
- Can be used by any user to purchase marketplace products.
- Can be transferred by **active volunteers only** to another active volunteer.

A revoked volunteer's wallet is frozen: it may hold donated rescue funds, so it can't be used for purchases until the volunteer is restored. Their balance is kept.

---

# 13. Volunteer-to-Volunteer Transfers

An active volunteer can transfer some or all of their wallet balance to another active volunteer.

```text
Volunteer A
Balance: ৳10,000

       ↓
Transfer ৳3,000

       ↓

Volunteer B
Balance increases by ৳3,000
```

The transaction is recorded with:

- Sender
- Receiver
- Amount
- Date/time
- Transaction type
- Reference / optional note (up to 200 characters)

Transfers to yourself, to revoked volunteers, or to suspended accounts are rejected.

---

# 14. Marketplace

PawAid includes an internal e-commerce marketplace that sells products useful for animal rescue.

Example categories:

### Medicine

- Animal medicine
- First-aid supplies
- Bandages
- Syringes

### Food

- Dog food
- Cat food
- Other animal food

### Rescue Equipment

- Animal cages
- Rescue equipment
- Blankets
- Protective equipment

### Other Supplies

- Cleaning supplies
- Animal-care products

The storefront lists active products only, filterable by category (only categories with active products are shown). Each product has a details page with "you may also like" suggestions.

Shoppers never see a product's cost price. Instead, each product shows how much of every sale goes to the PawAid Fund.

The cart is kept in the browser and tied to the signed-in user. A guest's cart is adopted on sign in; another account's cart is never shown. Prices and stock in the cart are re-checked against the server.

---

# 15. Marketplace Users

Both normal users and volunteers can purchase products.

Online payments (bKash, Nagad, card) are switched off for now. Checkout offers two methods: **cash on delivery** and **wallet**.

### Normal User / Volunteer

```text
Normal User
      ↓
Cash on Delivery/Wallet Fund
      ↓
Marketplace Order
```

---

# 16. Marketplace Product Profit

Every marketplace product has:

- Product cost
- Selling price
- Profit

```text
Product:

Cost Price:          ৳700
Selling Price:       ৳1,000
Profit:              ৳300
```

- A product can never be priced below its cost, since marketplace profit funds rescues.
- Each order line stores the unit price *and* unit cost at the time of sale, so later price or cost edits don't change past profit.

The profit generated from marketplace sales goes into the PawAid Fund (§17).

Users can see the profit generated by products.

---

# 17. PawAid Fund (Rescue Fund)

Rescue Fund is presented to users as the **PawAid Fund**. It is a single platform-wide fund.

The PawAid Fund represents money generated for rescue activities. Its source is marketplace profit.

```text
Marketplace

Total Revenue       ৳500,000
Product Costs       ৳350,000
Profit              ৳150,000
PawAid Fund         ৳150,000
```

Profit is posted to the fund when an order is marked **Delivered**, not when it is paid. A delivered order is a final sale, so a cancellation can never claw back profit that was already given out. Each order's profit is posted exactly once.

The fund tracks the total it has received and the total it has given out. The database prevents it from giving out more than it has received.

Users can view the fund's balance and its recent donations.

---

# 18. PawAid Fund Usage

Admins donate from the PawAid Fund to support rescue activities.

```text
PawAid Fund
    ↓
Admin donates
    ↓
Volunteer  ──or──  Rescue Post
    ↓                  ↓
Volunteer wallet   Post's volunteer wallet
                   (or held on the post until a volunteer takes it)
```

A fund allocation is recorded as a **donation whose donor is the PawAid Fund**, so it appears in the donation lists and follows the same rules as a community donation. The ledger entry (`RESCUE_FUND_ALLOCATION`) records which admin made it. Admins make these donations from the Transparency page.

---

# 19. Financial Transparency

Financial transparency is a core feature of PawAid. The public Transparency page (`/transparency`) shows aggregated figures, all computed from the ledger:

```text
              PAWAID FINANCIAL OVERVIEW

Donations
  Total donations / count / this month
  Distinct donors (count only)
  To rescues vs direct to volunteers
  Average donation
Wallet top ups

Volunteers
  Active volunteers
  Funds held in volunteer wallets
  Moved from rescues to volunteers on assignment
  Held for rescues awaiting a volunteer

Rescues
  Total / awaiting volunteer / in progress / rescued
  Funded rescues
  Documented rescue expenses (amount and count)

Marketplace
  Revenue (net of refunds)
  Profit
  Delivered orders

PawAid Fund
  Received / donated / balance
  Given to volunteers vs rescue posts
  Recent fund donations
```

The overview shows aggregated numbers rather than individual donors' financial transactions. Individual donations, with donor names, are on the public donations page instead (§10).

---

# 20. Financial Transaction Records

Although users see aggregated information, the backend keeps a detailed ledger (`FinancialTransaction`), and every wallet balance change has a matching `WalletTransaction` (credit or debit) linked to it.

Every financial transaction has:

- Transaction ID
- Source
- Destination
- Amount
- Transaction type
- Related user
- Related volunteer
- Related rescue post
- Related order
- Related payment / donation / fund
- Timestamp
- Status (`PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`)
- Reference

The implemented transaction types are:

```text
INCOME                  wallet top up
DONATION                user → rescue post or volunteer
TRANSFER                volunteer → volunteer, and unassigned post funds → volunteer on assignment
ORDER_PAYMENT           marketplace purchase (wallet or cash on delivery)
REFUND                  cancelled wallet order refunded to the buyer's wallet, or a donation
                        refunded from a post closed before a volunteer took it (§11)
MARKETPLACE_PROFIT      delivered order's profit → PawAid Fund
RESCUE_FUND_ALLOCATION  PawAid Fund → volunteer or rescue post
EXPENSE                 reserved, not used yet
```

`WALLET_TRANSFER` and `MARKETPLACE_PURCHASE` from 1.0 became `TRANSFER` and `ORDER_PAYMENT`.

Admins can browse the whole ledger read-only.

---

# 21. Rescue Expense Documentation

A rescue expense is **documentation only — no money moves**. Wallet funds can only be spent in the marketplace or transferred (§12.1), so an expense is a public record of where a rescue's money went, not a ledger entry.

The volunteer handling a rescue records an expense with:

- Amount
- Description (what it was spent on)
- A receipt photo, a link to one of their own marketplace orders, or both

Rules:

- Only the assigned volunteer can record expenses, while the rescue is Assigned, In Progress or Rescued (follow-up vet visits count too).
- A linked order must belong to the volunteer and not be cancelled or refunded.
- The expenses linked to one order cannot add up to more than the order's total.
- A volunteer can remove an expense they recorded by mistake.
- Only product names from a linked order are shown publicly, never delivery details.

Anyone can see a rescue's expenses and their total.

```text
Rescue Expense

Volunteer: John Doe
Rescue: Injured Dog - Mirpur
Amount: ৳2,500

Description:
Veterinary medicine and treatment

Receipt: [photo]   Order: #A1B2C3D4
```

---

# 22. Marketplace Orders

The marketplace operates like a standard e-commerce platform.

Order information:

- Order ID (shown as an 8-character order number)
- Buyer
- Products, quantity, unit price (and unit cost, internal)
- Total amount
- Payment method and payment status
- Order status
- Delivery name, phone and address (a snapshot taken at checkout; can optionally be saved to the profile)
- Created date

Checkout rules:

- Prices always come from the server. If the total changed since the buyer opened checkout, they are asked to confirm the new total.
- Stock is checked and reduced atomically, so two buyers can't both take the last unit.
- A wallet order is paid immediately and starts as `CONFIRMED`. A cash order starts as `PENDING` and its payment is collected on delivery.

Statuses:

```text
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
   └──────────┴────────────┴───────────┴──→ CANCELLED
REFUNDED (reserved)
```

Orders only move forward and can be cancelled any time before delivery.

- **Delivered:** a cash payment is marked collected and the sale starts counting as revenue; the order's profit is posted to the PawAid Fund.
- **Cancelled:** items go back into stock. A wallet payment is refunded to the buyer's wallet as its own `REFUND` ledger entry; uncollected cash is marked failed.

Buyers see their orders on their profile (All / Active / Delivered / Cancelled) and on an order details page.

---

# 23. Payment System

The intended payment gateway is **SSLCommerz**.

Because PawAid is a portfolio project, payment processing is simulated:

- **Wallet top up** is a dummy top up: it records a completed payment without collecting money.
- **Checkout** uses cash on delivery or the wallet.
- A simulated provider for external methods (bKash, Nagad, card) exists in `payment.services.js` but is switched off.

The architecture keeps payment processing separate from the core business logic so that a real provider can be integrated later. With a real gateway, a top up or order would only be confirmed from the gateway's callback.

```text
Payment Service
      ↓
Simulated Payment Provider
      ↓
Payment Result
      ↓
Wallet Top Up / Order
```

## 23.1 Duplicate-Payment Protection

*New in 1.1.* Every request that moves money (top up, donations, transfers, checkout, PawAid Fund donations) must carry an `Idempotency-Key` header. The client sends the same key for every attempt at the same payment (a double click, a retry after a timeout):

- The first request runs and its successful response is saved.
- A repeat after success gets the saved response back; nothing is charged twice.
- A repeat while the first is still running is rejected (409).
- A repeat after a failure runs normally, since the failed attempt changed nothing.
- A key is bound to one user, one endpoint and one request body, and expires after 24 hours.

---

# 24. Community Comments

Users can comment on rescue posts.

Comments contain:

- Author
- Post
- Content
- Timestamp

Comments are paginated, newest first. Authors can delete their own comments; admins can delete any comment.

Comments have no status field; moderation is by deletion.

---

# 25. Post Reporting

Users can report inappropriate or suspicious posts.

A report contains:

- Reporter
- Reported post
- Reason (Spam, Fake or misleading, Inappropriate content, Scam or fraud, Other)
- Description (optional)
- Timestamp
- Status

Report statuses:

```text
PENDING
REVIEWED
RESOLVED
REJECTED
```

Rules:

- A user cannot report their own post.
- A user can have only one pending report per post.
- Admins work the report queue oldest first.
- Taking a post down resolves all of its open reports.

---

# 26. Post Moderation

Admins can:

- View, search and filter posts (by status, area, reported)
- Review reported posts
- Change a post's status
- Take down posts
- Review post creators
- Monitor rescue activity

Taking a post down sets its status to `CANCELLED`. The post leaves the public feed and volunteer profiles but stays in the database, so its financial records are kept. The creator and admins can still open it.

If the post had no volunteer, the money it was holding is refunded to its donors (§11), and the admin is told how much before confirming. If it had a volunteer, the money stays in their wallet.

---

# 27. Admin Dashboard

The Admin dashboard (`/admin`) is a single page with tabs: **Overview, Reports, Posts, Users, Volunteers, Areas, Products, Orders, Transactions.** Admin tables page by offset with search and filters.

## Dashboard Overview

Metrics include:

```text
Total Users
Total Volunteers
Active Volunteers
Total Rescue Posts
Active Rescues
Total Donations (community donations only)
Total Marketplace Sales
Total Marketplace Profit
PawAid Fund
```

---

## User Management

Admin can:

- View and search users
- View user profiles
- Suspend and reactivate users
- View volunteer status

A suspended user is signed out on their next request and cannot sign in.

---

## Volunteer Management

Admin can:

- View volunteers
- Search/filter volunteers
- View volunteer profiles, including NID
- Revoke volunteer status
- Restore volunteer status
- View wallet balances (read-only)
- View rescue activity

Admin cannot modify wallet balances. Every balance change goes through a financial transaction.

---

# 28. Marketplace Administration

Admin manages the marketplace.

Admin can:

- Create products (with image)
- Edit products
- Deactivate products (products are deactivated, not deleted, because past orders point at them)
- Set product price
- Set product cost (price can never be below cost)
- Manage inventory
- Create categories
- View orders
- Update order status
- View product profitability

Only Admin can manage marketplace products.

---

# 29. Access Control

The system uses role-based access control, plus a check on the volunteer profile's status for volunteer-only actions.

| Feature                    | Admin       | Volunteer         | Normal User |
| -------------------------- | ----------- | ----------------- | ----------- |
| View community             | Yes         | Yes               | Yes         |
| Create rescue post         | Yes         | Yes               | Yes         |
| Comment / upvote / report  | Yes         | Yes               | Yes         |
| Top up wallet              | Yes         | Yes               | Yes         |
| Donate (from wallet)       | Yes         | Yes               | Yes         |
| Apply as volunteer         | No          | Already volunteer | Yes         |
| Assign self to rescue      | No          | Yes               | No          |
| Post rescue updates        | No          | Assigned only     | No          |
| Record rescue expenses     | No          | Assigned only     | No          |
| Own wallet & history       | Yes         | Yes               | Yes         |
| View other wallets         | Read-only   | Public profile    | Public profile |
| Marketplace purchase (COD) | Yes         | Yes               | Yes         |
| Use wallet for purchase    | No          | Yes               | Yes         |
| Transfer wallet funds      | No          | Yes               | No          |
| Manage products            | Yes         | No                | No          |
| Manage users               | Yes         | No                | No          |
| Revoke volunteer           | Yes         | No                | No          |
| Remove posts               | Yes         | No                | No          |
| View financial overview    | Yes         | Yes               | Yes         |
| Donate from PawAid Fund    | Yes         | No                | No          |

"Volunteer" means an *active* volunteer. A revoked volunteer has normal-user permissions, except that their wallet can't be used for purchases (§12.1).

---

# 30. Core Data Entities

The implemented database has the following entities.

```text
User
VolunteerProfile
RescueArea
RescuePost
RescuePostImage
RescueUpdate          
RescueUpdateImage     
Comment
PostUpvote            
PostReport

Donation
Wallet               
WalletTransaction

Product
ProductCategory
Order
OrderItem

Payment
FinancialTransaction
RescueFund            
RescueExpense         
IdempotencyKey        
```


All money amounts are stored as whole-taka integers. The ER diagram is in `Schema.mmd` / `Schema.png`, and the source of truth is `backend/prisma/schema.prisma`.

---

# 31. Important Financial Architecture Rule

Wallet balances should not be treated as the sole source of truth.

Instead, the system maintains a transaction ledger. Every write to a wallet balance happens in the same database transaction as its `WalletTransaction` row, which links to the `FinancialTransaction` that caused it.

```text
Wallet Transaction History

+ ৳5,000  Donation
+ ৳2,000  Donation
- ৳1,500  Marketplace Purchase
+ ৳3,000  Transfer Received
- ৳2,000  Transfer Sent
-------------------------
= ৳6,500 Balance
```

This is particularly important because PawAid deals with money.

---

# 32. Main User Flow — Becoming a Volunteer

```text
Normal User
     ↓
Apply as Volunteer
     ↓
Provide NID, phone, address, description
     ↓
Select Rescue Area
     ↓
Volunteer Account Activated
     ↓
Public Volunteer Profile Created
     ↓
Volunteer Can Participate in Rescues
```

No Admin approval is required.

Admin can revoke the role later.

---

# 33. Main User Flow — Creating a Rescue Request

```text
User / Volunteer
       ↓
Create Rescue Post
       ↓
Upload Animal Images
       ↓
Describe Rescue Situation (+ optional donation target)
       ↓
Publish
       ↓
Community
       ↓
Users Donate (from their wallets)
       ↓
Donation Held on the Post
       ↓
Volunteer Assigns Self
       ↓
Funds Move to Volunteer Wallet
       ↓
Volunteer Posts Updates & Expenses
       ↓
Volunteer Marks Rescue as Rescued
```

---

# 34. Main User Flow — Direct Volunteer Donation

```text
User
 ↓
Top Up Wallet (if needed)
 ↓
Volunteer Profile
 ↓
Donate
 ↓
Donation Recorded
 ↓
Volunteer Wallet
```

---

# 35. Main User Flow — Wallet Marketplace Purchase

```text
User / Volunteer
    ↓
Marketplace
    ↓
Add Products to Cart
    ↓
Checkout (delivery details)
    ↓
Choose Wallet
    ↓
Check Wallet Balance
    ↓
Reserve Stock, Create Order & Payment
    ↓
Deduct Wallet Amount
    ↓
Create Wallet Transaction
```

All of these steps happen in one database transaction. The purchase fails if the buyer's wallet balance is insufficient, or if the buyer is a revoked volunteer.

---

# 36. Main User Flow — Volunteer Transfer

```text
Volunteer A
    ↓
Select Volunteer B
    ↓
Enter Amount (+ optional note)
    ↓
Confirm Transfer
    ↓
Debit Volunteer A
    ↓
Credit Volunteer B
    ↓
Create Transaction Records
```

Both sides receive corresponding transaction records.

---

# 37. Main User Flow — Marketplace Profit

```text
Customer Purchase
       ↓
Marketplace Order
       ↓
Admin moves order through to Delivered
       ↓
Payment Completed (cash collected / wallet already paid)
       ↓
Revenue Recorded
       ↓
Profit = Σ (unit price − unit cost) × quantity
       ↓
Profit Added to PawAid Fund
```

```text
Sale Price:       ৳1,000
Product Cost:       ৳700
Profit:             ৳300

PawAid Fund:
+ ৳300
```

---

# 38. Main User Flow — PawAid Fund Allocation

```text
Marketplace Profit
       ↓
PawAid Fund
       ↓
Admin Donates (Transparency page)
       ↓
Volunteer / Rescue Post
       ↓
Funds Available for Marketplace Rescue Purchases
```

The allocation creates a donation and a `RESCUE_FUND_ALLOCATION` financial transaction, and fails if the fund doesn't have enough.

---

# 39. Security Requirements

Because the platform handles user identity and financial information, the backend implements:

- Password hashing (bcrypt) — **done**
- Authentication tokens (JWT, 7-day expiry, in an httpOnly cookie) — **done**
- Role-based authorization (admin and active-volunteer middleware) — **done**
- Input validation (Zod) — **done**
- File upload validation: JPEG, PNG, GIF or WebP checked by file contents, 5 MB limit, file count per route — **done**
- NID data protection: never in public responses — **done**
- Secure payment handling — simulated (§23)
- Transaction authorization — **done**
- Prevention of duplicate payments (idempotency keys, §23.1) — **done**
- Prevention of unauthorized wallet access — **done**
- Database transaction consistency, including atomic balance checks — **done**
- Suspended accounts are signed out on their next request — **done**
- Audit logs for administrative actions (append only, viewable in the admin panel) — **done**
- Server-side sessions: signing out, signing out of all devices, suspension and password resets revoke the login token immediately — **done**
- CSRF protection for the login cookie (requests that change data need an `X-Requested-With` header) — **done**
- Rate limiting on sign in, sign up, Google sign-in, password reset and money-moving routes — **done**
- CAPTCHA (Cloudflare Turnstile) on email/password sign in and sign up, against bots and password guessing — **done**
- Password reset by single-use, 30 minute emailed link; only a hash of the token is stored (§5.1.1) — **done**
- Security headers (HSTS, nosniff, frame denial, strict content security policy) — **done**
- Image storage kept inside the Cloudflare R2 free tier: the admin is emailed at 80% of the monthly allowance and uploads pause at 90% — **done**

NID information is never publicly visible on volunteer profiles. Contact details, wallet and NID on a user profile are only visible to the owner and admins.

---

# 40. Financial Integrity Requirements

Financial operations must be atomic.

For example, a wallet purchase should not result in:

```text
Wallet deducted
Order not created
```

or:

```text
Order created
Wallet not deducted
```

Both operations succeed or fail together.

The same principle applies to:

- Wallet top ups
- Donations
- Wallet transfers
- Rescue assignment (moving unassigned funds)
- Marketplace purchases, cancellations and refunds
- Profit posting
- PawAid Fund donations

Every one of these runs in a database transaction. Balance checks are done in the same statement as the deduction, so concurrent requests can't spend the same money twice. The database also enforces that a donation has exactly one source (a user or the fund) and that the fund is never overdrawn.

---

# 41. Public Financial Information

Public users can view aggregated financial information:

- Total donations
- Total marketplace revenue
- Total marketplace profit
- PawAid Fund received, donated and remaining
- Volunteer aggregate donation and wallet information
- Documented rescue expenses

They can also see individual donations on the public donations page: donor name, amount, recipient and date (§10). Wallet balances, wallet top ups, purchases and transfers of individual users are never public.

---

# 42. MVP Scope

Status key: ✅ built · 🟡 partly built / changed · ⬜ not built

### Authentication

- ✅ Registration
- ✅ Login
- ✅ Google sign-in
- ✅ Forgotten password reset by email
- ✅ Logout (`POST /signout` ends the session on the server and clears the cookie; "Log out of all devices" ends every session)
- ✅ Role management

### Volunteers

- ✅ Volunteer application
- ✅ Volunteer profile
- ✅ Rescue area selection
- ✅ Volunteer directory
- ✅ Volunteer donation

### Community

- ✅ Create, edit and delete rescue posts
- ✅ Upload images
- ✅ Rescue donation
- ✅ Comments
- ✅ Upvotes
- ✅ Post reporting
- ✅ Admin post moderation
- ✅ Rescue details page, progress updates and status lifecycle

### Donation System

- ✅ One-time donations
- ✅ Post donations
- ✅ Volunteer donations
- ✅ Unassigned donation balance
- ✅ Wallets
- 🟡 Payment: simulated wallet top up instead of a payment per donation

### Wallet

- ✅ Wallet balance
- ✅ Wallet transaction history
- ✅ Marketplace purchases
- ✅ Volunteer-to-volunteer transfers

### Marketplace

- ✅ Product categories
- ✅ Products
- ✅ Product pricing, cost and profit
- ✅ Inventory
- ✅ Cart
- ✅ Orders
- 🟡 Checkout (cash on delivery and wallet; online payment switched off)

### PawAid Fund

- ✅ Marketplace profit tracking
- ✅ Fund balance
- ✅ Admin allocation (fund donations)
- ✅ Public financial overview
- ✅ Rescue expense documentation

### Admin

- ✅ User management
- ✅ Volunteer management
- ✅ Post moderation and report queue
- ✅ Area management
- ✅ Product management
- ✅ Order management
- ✅ Financial dashboard and read-only ledger

### Hardening

- ✅ Duplicate-payment prevention
- ✅ Audit logs for admin actions
- ✅ Rate limiting, sessions, CSRF protection and security headers
- ✅ CAPTCHA on sign in and sign up
- 🟡 Automated tests: every flow and the ledger reconciliation are tested; a single end-to-end test of the §43 flow is still to be written

---

# 43. MVP Success Criteria

The MVP should successfully demonstrate the following complete flow:

```text
User registers
      ↓
User creates rescue post
      ↓
Another user sees the post
      ↓
User tops up their wallet and donates
      ↓
Donation remains unassigned
      ↓
Volunteer assigns themselves
      ↓
Donation moves to volunteer wallet
      ↓
Volunteer purchases medicine with their wallet
      ↓
Wallet balance decreases
      ↓
Order is created
      ↓
Admin marks the order Delivered
      ↓
Marketplace profit is calculated
      ↓
Profit goes into the PawAid Fund
      ↓
Users can view the updated financial overview
```

If this end-to-end flow works correctly, the core PawAid concept is functioning. Every step is implemented; an automated end-to-end test of the flow is still to be written.

---
