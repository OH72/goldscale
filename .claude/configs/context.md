# GoldScale — Project Context

Personal finance web application. Single user. Local-only (Docker Compose). No production deployment.

## Tech Stack

### Backend
- Java 21, Spring Boot 3, Spring MVC, Spring Data MongoDB (imperative, NOT reactive)
- Spring Security: HTTP Basic Auth (credentials in application.yml, overridable via env vars)
- MongoDB 7 with single-node Replica Set (required for multi-document transactions)
- Maven, Docker

### Frontend
- React 19, TypeScript, Vite
- Tailwind CSS, Shadcn/ui
- TanStack Query (React Query) — server state
- Zustand — client-only UI state
- React Router v7
- React Hook Form + Zod — forms and validation
- TanStack Table — data tables
- Recharts — charts
- date-fns — date formatting
- sonner — toast notifications
- react-error-boundary — error boundaries

## Data Model

### Collections
- `accounts` — user bank accounts with denormalized balance
- `categories` — income/expense categories (flat, no hierarchy)
- `transactions` — all financial operations
- `settings` — app preferences (default currency)
- NO `users` collection — single user, auth via config

### Amounts
- Stored as **long integers in smallest currency unit** (kopiyky/cents)
- 12.34 UAH = 1234, 100.00 USD = 10000
- Always positive. Sign derived from TransactionType in business logic
- Java type: `long` for amounts and balances. No BigDecimal needed
- Frontend receives integers, divides by 100 for display
- Display-currency conversion is done by the backend only. `GET /accounts` returns `AccountResponse.balanceInDisplayCurrency` (`Long`, null when no exchange rate); create/update/findById responses carry null. The dashboard response has no accounts; dashboard.tsx uses `useAccounts()`.

### Transaction Types (enum)
- `INITIAL_BALANCE` — created with account, editable (amount only), NOT deletable
- `INCOME` — income, requires categoryId (type=INCOME)
- `EXPENSE` — expense, requires categoryId (type=EXPENSE)
- `TRANSFER` — between own accounts, no category. Single document with:
  - `accountId` (source), `targetAccountId` (target)
  - `amount` (source currency), `targetAmount` (target currency)
  - `exchangeRate` (derived: targetAmount/amount, for display only, stored as Double — not used in calculations)

### Balance
- Denormalized field on Account, updated atomically with `$inc`
- Create: `$inc` by +amount (INCOME/INITIAL_BALANCE) or -amount (EXPENSE)
- Transfer: `$inc` source by -amount, target by +targetAmount
- Edit: `$inc` by delta (newAmount - oldAmount)
- Soft delete: reverse the original `$inc`
- Audit endpoint: sum all active transactions, compare with stored balance, fix if mismatch

### Soft Delete
- Transactions have `deleted: boolean` field
- All queries filter `{deleted: {$ne: true}}`
- INITIAL_BALANCE cannot be deleted
- Accounts: deleting account soft-deletes all related transactions

### Categories
- Typed: INCOME or EXPENSE
- Cannot delete if transactions reference it
- Flat structure, no subcategories

### Timestamps
- `LocalDate` for business date (user-selected)
- `Instant` for system timestamps (createdAt, updatedAt)

### Indexes (transactions)
- `{accountId: 1, date: -1}` — primary query pattern
- `{targetAccountId: 1, date: -1}` — transfers TO account
- `{accountId: 1, type: 1}` — filter by type
- `{categoryId: 1}` — analytics by category

## Auth
- HTTP Basic with BCrypt
- Credentials in `application.yml`, overridable via environment variables
- No JWT, no session management
