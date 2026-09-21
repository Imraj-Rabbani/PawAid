# PawAid — Product Requirements Document

**Version:** 1.0  
**Status:** Initial Product Definition  
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

The platform will also provide financial transparency. Users will be able to see aggregated information about donations, marketplace revenue, marketplace profit, rescue contributions, volunteer balances, and rescue expenditures.

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
- Give each volunteer a restricted wallet for rescue funds.
- Allow volunteers to spend their wallet balance only through the PawAid marketplace.
- Allow volunteers to transfer wallet funds to other volunteers.
- Provide a marketplace for rescue-related products.
- Allocate marketplace profit toward rescue activities.
- Provide financial transparency to users.
- Allow multiple rescue volunteers to operate on the platform.



## 3.2 Transparency Goal

Users should be able to understand the flow of money at an aggregated level.

Example:

```text
Total Donations
      ↓
Volunteer / Rescue Wallets
      ↓
Marketplace Purchases
      ↓
Rescue Products
```

And separately:

```text
Marketplace Sales
      ↓
Product Cost
      ↓
Marketplace Profit
      ↓
Rescue Contribution
      ↓
Rescue Funding
```

---



# 4. User Roles

PawAid has three primary user roles.

## 4.1 Admin

The administrator manages the rescue platform.

Admin capabilities include:

- Manage users
- Manage volunteers
- Revoke volunteer status
- Manage rescue areas
- Manage community posts
- Remove inappropriate posts
- Review reported posts
- Manage marketplace products
- Manage orders
- View donations
- View volunteer wallets
- Manage rescue funding
- Allocate rescue funds
- View financial reports


---



## 4.2 Volunteer

A volunteer is a registered user who participates in animal rescue activities.

Volunteers can:

- Select a rescue area
- Update their profile
- Create rescue posts
- Assign themselves to rescue posts
- Receive donations
- Maintain a rescue wallet
- Purchase rescue products using wallet funds
- Donate wallet funds to another volunteer
- Purchase marketplace products using personal payment
- View their transaction history

Volunteer status can be revoked by the Admin.

A revoked volunteer should no longer be able to perform volunteer-specific actions.

---



## 4.3 Normal User

Normal users can:

- Register and create an account
- Browse rescue posts
- Create rescue posts
- Donate to rescue posts
- Donate directly to volunteers
- Browse volunteers
- Browse volunteers by rescue area
- View volunteer donation information
- Comment on posts
- Report posts
- Purchase products from the marketplace
- View marketplace financial information

A normal user can later apply to become a volunteer.

---




# 5. User Registration



## 5.1 Normal User Registration

Minimum information:

- Name
- Email
- Password

Additional account/profile information can be collected after registration.

---



## 5.2 Volunteer Application

A normal user can apply to become a volunteer.

Required volunteer information:

- Name
- Email
- Phone
- Address
- Profile picture
- NID
- Rescue area
- Postal code
- Personal description

The selected rescue area will be selected from a predefined frontend dropdown.

Volunteer approval is not required.

After becoming a volunteer, the user receives volunteer privileges.

The Admin can revoke the volunteer role at any time.

---



# 6. Rescue Areas

Rescue areas will initially be predefined by the Admin.

Example:

```text
Dhaka
├── Dhanmondi
├── Mirpur
├── Uttara
├── Mohammadpur
└── Farmgate
```


For the initial version, the frontend will use dropdown selection rather than GPS-based location selection.

A volunteer can have one active rescue area.

Volunteers can change their selected rescue area.

Users should be able to browse/filter volunteers by rescue area.

---



# 7. Volunteer Profile

Every volunteer will have a public profile.

The profile should contain:

- Name
- Profile picture
- Description
- Rescue area
- Volunteer status
- Total donations received
- Total amount spent
- Current available wallet balance
- Rescue activity information

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

---



# 8. Community / Rescue Posts

The Community section is the central rescue coordination area.

Both volunteers and normal users can create rescue posts.

## 8.1 Rescue Post

A rescue post may contain:

- Title
- Description
- Animal images
- Rescue location/area
- Creator
- Creation date
- Donation target
- Donation amount received
- Rescue status
- Assigned volunteer
- Comments

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

---



# 9. Rescue Assignment

A rescue post created by a normal user may initially have no assigned volunteer.

Donations made to that post are stored as **unassigned rescue funds**.

Example:

```text
User creates rescue post
        ↓
Donations received
        ↓
Unassigned Rescue Fund
        ↓
Volunteer assigns themselves
        ↓
Funds transferred to Volunteer Wallet
```

Once a volunteer assigns themselves to the rescue:

- The rescue post becomes assigned.
- The associated donation balance is transferred to that volunteer's wallet.
- The volunteer becomes responsible for the rescue activity.

The initial version should allow one volunteer to be assigned to a rescue post.

---



# 10. Donations

PawAid supports one-time donations.

There are two primary donation destinations.

## 10.1 Donation to Rescue Post

Users can donate directly to a rescue post.

```text
User
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
User
 ↓
Rescue Post
 ↓
Assigned Volunteer Wallet
```

---



## 10.2 Donation to Volunteer

Users can donate directly from a volunteer's public profile.

```text
User
 ↓
Volunteer Profile
 ↓
Volunteer Wallet
```

The volunteer's total donations received should be visible publicly.

---



# 11. Donation Rules

- Donations are one-time.
- Donor account information is stored.
- Donations to unassigned rescue posts remain unassigned until a volunteer takes responsibility.
- Donations assigned to a volunteer become part of the volunteer's wallet.
- Donation money cannot be withdrawn as cash.
- Donations cannot be refunded through the initial system.
- Volunteers can use wallet funds only within the PawAid marketplace.
- Volunteers can transfer wallet funds to other volunteers.

---



# 12. Volunteer Wallet

Every volunteer has a wallet.

The wallet represents restricted rescue funds.

Example:

```text
Volunteer Wallet

Current Balance:       ৳20,000

Received Donations:   ৳30,000
Received Transfers:   ৳5,000
Marketplace Spending: ৳15,000

```



## 12.1 Wallet Restrictions

Wallet funds:

- Cannot be withdrawn as cash.
- Cannot be transferred to external payment accounts.
- Can be used to purchase marketplace products.
- Can be transferred to another volunteer.
- Can be used for rescue-related purchases available through the marketplace.

---



# 13. Volunteer-to-Volunteer Transfers

A volunteer can transfer some or all of their wallet balance to another volunteer.

Example:

```text
Volunteer A
Balance: ৳10,000

       ↓
Transfer ৳3,000

       ↓

Volunteer B
Balance increases by ৳3,000
```

The transaction must be recorded.

Transaction information should include:

- Sender
- Receiver
- Amount
- Date/time
- Transaction type
- Reference

---



# 14. Marketplace

PawAid includes an internal e-commerce marketplace.

The marketplace sells products useful for animal rescue.

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

---



# 15. Marketplace Users

Both normal users and volunteers can purchase products.

### Normal User

Payment:

```text
Normal User
      ↓
External/Simulated Payment
      ↓
Marketplace Order
```



### Volunteer

Payment options:

```text
Volunteer
    ↓
Wallet Balance
    ↓
Marketplace
```

or

```text
Volunteer
    ↓
Personal Payment
    ↓
Marketplace
```

---



# 16. Marketplace Product Profit

Every marketplace product has:

- Product cost
- Selling price
- Profit

Example:

```text
Product:

Cost Price:          ৳700
Selling Price:       ৳1,000
Profit:              ৳300
```

The profit generated from marketplace sales contributes to the volunteer's rescue fund.

Users should be able to see the profit generated by products.

---



# 17. Rescue Fund

The Rescue Fund represents money generated for rescue activities.

One major source is marketplace profit.

Example:

```text
Marketplace

Total Revenue       ৳500,000
Product Costs       ৳350,000
Profit              ৳150,000
Rescue Contribution ৳150,000
```

The platform should accumulate the contribution.

Users can view the accumulated rescue fund.

---



# 18. Rescue Fund Usage

Admins can use accumulated marketplace profits to fund rescue activities.

Example:

```text
Rescue Fund
    ↓
Admin allocates funding
    ↓
Volunteer
    ↓
Volunteer wallet
```

This allows the volunteers to financially support rescue activities beyond individual donations.

---



# 19. Financial Transparency

Financial transparency is a core feature of PawAid.

Users should be able to view aggregated financial information.

Example:

```text
              PAWAID FINANCIAL OVERVIEW

Total Donations                 ৳500,000

Volunteer Funds                 ৳350,000

Marketplace Revenue             ৳800,000

Marketplace Profit              ৳150,000

Rescue Contribution              ৳150,000

Rescue Fund Available            ৳150,000

Rescue Fund Used                  ৳80,000

Rescue Fund Remaining             ৳70,000
```

The initial version will show aggregated numbers rather than individual financial transactions to the public.

---



# 20. Financial Transaction Records

Although users see aggregated information, the backend should maintain detailed transaction records.

Every financial transaction should have:

- Transaction ID
- Source
- Destination
- Amount
- Transaction type
- Related user
- Related volunteer
- Related rescue post
- Related order
- Timestamp
- Status
- Reference

Possible transaction types:

```text
DONATION
WALLET_TRANSFER
MARKETPLACE_PURCHASE
MARKETPLACE_PROFIT
RESCUE_FUND_ALLOCATION
```

---



# 21. Rescue Expense Documentation

For rescue-related spending, supporting documentation should be stored where applicable.

Example:

```text
Rescue Expense

Volunteer: John Doe
Rescue: Injured Dog - Mirpur
Amount: ৳2,500

Description:
Veterinary medicine and treatment

```



---



# 22. Marketplace Orders

The marketplace should operate similarly to a standard e-commerce platform.

Order information:

- Order ID
- Buyer
- Products
- Quantity
- Product price
- Total amount
- Payment method
- Order status
- Delivery information
- Created date
- Updated date

Possible statuses:

```text
PENDING
CONFIRMED
PROCESSING
SHIPPED
DELIVERED
CANCELLED
```

---



# 23. Payment System

The intended payment gateway is **SSLCommerz**.

However, because PawAid is initially a portfolio project, payment processing will be simulated.

The architecture should still separate payment processing from the core business logic so that a real payment provider can be integrated later.

Example:

```text
Payment Service
      ↓
Simulated Payment Provider
      ↓
Payment Result
      ↓
Order / Donation
```

The system should not hard-code the assumption that payments are simulated.

---



# 24. Community Comments

Users can comment on rescue posts.

Comments should contain:

- Author
- Post
- Content
- Timestamp
- Status

Admins should be able to remove inappropriate comments if moderation is added to the implementation scope.

---



# 25. Post Reporting

Users can report inappropriate or suspicious posts.

A report should contain:

- Reporter
- Reported post
- Reason
- Description
- Timestamp
- Status

Possible report statuses:

```text
PENDING
REVIEWED
RESOLVED
DISMISSED
```

Admins can review reports.

Admins can take down posts.

---



# 26. Post Moderation

Admins can:

- View posts
- Review reported posts
- Remove posts
- Review post creators
- Monitor rescue activity

Removing a post should not silently delete its financial records.

---



# 27. Admin Dashboard

The Admin dashboard should provide a centralized management interface.

## Dashboard Overview

Possible metrics:

```text
Total Users
Total Volunteers
Active Volunteers
Total Rescue Posts
Active Rescues
Total Donations
Total Marketplace Sales
Total Marketplace Profit
Total Rescue Fund
```

---



## User Management

Admin can:

- View users
- View user profiles
- Suspend users
- View volunteer status

---



## Volunteer Management

Admin can:

- View volunteers
- Search/filter volunteers
- View volunteer profiles
- Revoke volunteer status
- Restore volunteer status
- View wallet balances
- View rescue activity

Admin cannot manually modify wallet balances without creating an appropriate financial transaction.

---



# 28. Marketplace Administration

Admin manages the marketplace.

Admin can:

- Create products
- Edit products
- Delete/deactivate products
- Set product price
- Set product cost
- Manage inventory
- Manage categories
- View orders
- Update order status
- View product profitability

Only Admin can manage marketplace products in the initial version.

---



# 29. Access Control

The system should use role-based access control.

Basic permission model:


| Feature                  | Admin       | Volunteer         | Normal User |
| ------------------------ | ----------- | ----------------- | ----------- |
| View community           | Yes         | Yes               | Yes         |
| Create rescue post       | Yes         | Yes               | Yes         |
| Comment                  | Yes         | Yes               | Yes         |
| Donate                   | Yes         | Yes               | Yes         |
| Create volunteer profile | Yes         | Yes               | No          |
| Apply as volunteer       | No          | Already volunteer | Yes         |
| Assign self to rescue    | No          | Yes               | No          |
| Volunteer wallet         | View/manage | Own wallet        | No          |
| Marketplace purchase     | Yes         | Yes               | Yes         |
| Use wallet for purchase  | No          | Yes               | No          |
| Transfer wallet funds    | No          | Yes               | No          |
| Manage products          | Yes         | No                | No          |
| Manage users             | Yes         | No                | No          |
| Revoke volunteer         | Yes         | No                | No          |
| Remove posts             | Yes         | No                | No          |
| View financial overview  | Yes         | Yes               | Yes         |
| Manage rescue fund       | Yes         | No                | No          |


---



# 30. Core Data Entities

The initial database should be designed around the following entities.

```text
User
VolunteerProfile
RescueArea
RescuePost
RescuePostImage
Comment
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
Receipt
```

Relationships will be defined during the database design phase.

---



# 31. Important Financial Architecture Rule

Wallet balances should not be treated as the sole source of truth.

Instead, the system should maintain a transaction ledger.

For example:

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
Provide Volunteer Information
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
Describe Rescue Situation
       ↓
Publish
       ↓
Community
       ↓
Users Donate
       ↓
Donation Held in Unassigned Rescue Balance
       ↓
Volunteer Assigns Self
       ↓
Funds Move to Volunteer Wallet
```

---



# 34. Main User Flow — Direct Volunteer Donation

```text
User
 ↓
Volunteer Profile
 ↓
Donate
 ↓
Payment
 ↓
Donation Recorded
 ↓
Volunteer Wallet
```

---



# 35. Main User Flow — Volunteer Marketplace Purchase

```text
Volunteer
    ↓
Marketplace
    ↓
Select Product
    ↓
Checkout
    ↓
Choose Wallet
    ↓
Check Wallet Balance
    ↓
Deduct Wallet Amount
    ↓
Create Order
    ↓
Create Wallet Transaction
```

The purchase should fail if the volunteer's available wallet balance is insufficient.

---



# 36. Main User Flow — Volunteer Transfer

```text
Volunteer A
    ↓
Select Volunteer B
    ↓
Enter Amount
    ↓
Confirm Transfer
    ↓
Debit Volunteer A
    ↓
Credit Volunteer B
    ↓
Create Transaction Records
```

Both sides should receive corresponding transaction records.

---



# 37. Main User Flow — Marketplace Profit

```text
Customer Purchase
       ↓
Marketplace Order
       ↓
Payment Completed
       ↓
Revenue Recorded
       ↓
Product Cost Calculated
       ↓
Profit Calculated
       ↓
Profit Added to Rescue Contribution
       ↓
Rescue Fund Updated
```

Example:

```text
Sale Price:       ৳1,000
Product Cost:       ৳700
Profit:             ৳300

Rescue Fund:
+ ৳300
```

---



# 38. Main User Flow — Rescue Fund Allocation

```text
Marketplace Profit
       ↓
Rescue Fund
       ↓
Admin Allocates Funds
       ↓
Volunteer / Rescue Activity
       ↓
Funds Available for Marketplace Rescue Purchases
```

The allocation must create a financial transaction.

---



# 39. Security Requirements

Because the platform handles user identity and financial information, the backend should implement:

- Password hashing
- Authentication tokens/session management
- Role-based authorization
- Input validation
- File upload validation
- Image type/size restrictions
- NID data protection
- Secure payment handling
- Transaction authorization
- Prevention of duplicate payments
- Prevention of unauthorized wallet access
- Database transaction consistency
- Audit logs for sensitive administrative actions

NID information should not be publicly visible on volunteer profiles.

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

Both operations should succeed or fail together.

The same principle applies to:

- Donations
- Wallet transfers
- Marketplace purchases
- Rescue-fund allocations

Database transactions should be used wherever appropriate.

---



# 41. Public Financial Information

Public users should be able to view aggregated financial information.

They should be able to see:

- Total donations
- Total marketplace revenue
- Total marketplace profit
- Total rescue contribution
- Total rescue fund
- Total rescue fund used
- Remaining rescue fund
- Volunteer aggregate donation information

Individual donor financial details should not be publicly exposed.

---



# 42. MVP Scope

The first version of PawAid should focus on the core system.

## MVP Features



### Authentication

- Registration
- Login
- Logout
- Role management



### Volunteers

- Volunteer application
- Volunteer profile
- Rescue area selection
- Volunteer directory
- Volunteer donation



### Community

- Create rescue post
- Upload images
- Rescue donation
- Comments
- Post reporting
- Admin post moderation



### Donation System

- One-time donations
- Post donations
- Volunteer donations
- Unassigned donation balance
- Volunteer wallets



### Wallet

- Wallet balance
- Wallet transaction history
- Marketplace purchases
- Volunteer-to-volunteer transfers



### Marketplace

- Product categories
- Products
- Product pricing
- Product cost
- Product profit
- Inventory
- Orders
- Checkout



### Rescue Fund

- Marketplace profit tracking
- Rescue contribution
- Rescue fund balance
- Admin allocation
- Public financial overview



### Admin

- User management
- Volunteer management
- Post moderation
- Product management
- Order management
- Financial dashboard

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
User donates
      ↓
Donation remains unassigned
      ↓
Volunteer assigns themselves
      ↓
Donation moves to volunteer wallet
      ↓
Volunteer purchases medicine
      ↓
Wallet balance decreases
      ↓
Order is created
      ↓
Marketplace profit is calculated
      ↓
Profit contributes to rescue fund
      ↓
Users can view the updated financial overview
```

If this end-to-end flow works correctly, the core PawAid concept is functioning.

---

