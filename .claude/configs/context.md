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
- Zustand — client-only UI state (sidebar, page-level filters)
- React Router v7
- React Hook Form + Zod — forms and validation
- TanStack Table — data tables
- Recharts — charts
- next-themes — dark/light theme toggling (attribute="class" on html)
- date-fns — date formatting
- sonner — toast notifications
- react-error-boundary — error boundaries

## Data Model

### Collections
- `accounts` — user bank accounts with denormalized balance
- `categories` — income/expense categories with type (INCOME, EXPENSE, BOTH)
- `tags` — free-form labels; a transaction can have 0..N tags (`tags: List<String>` of tag IDs)
- `transactions` — all financial operations (soft-deletable)
- `people` — counterparties for debt/loan records
- `debt_records` — debts (I owe) and loans (they owe me) with embedded payments
- `event_log` — audit trail for all entity changes (create, update, delete)
- `exchangeRates` — daily USD-based exchange rates for currency conversion
- `settings` — app preferences (default currency, initial date)
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
- `INCOME` — income, requires categoryId
- `EXPENSE` — expense, requires categoryId
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
- Debt records have `deleted: boolean` field
- All queries filter `{deleted: {$ne: true}}`
- INITIAL_BALANCE cannot be deleted
- Accounts: deleting account soft-deletes all related transactions

### Categories
- Type field: `INCOME`, `EXPENSE`, or `BOTH` (CategoryType enum)
- Cannot delete if transactions reference it
- Flat structure, no subcategories
- Unique name constraint (no duplicates)
- Merge support: reassign all transactions and debt records from source to target, delete source
- Merge type widening: if source and target types differ and target is not BOTH, target becomes BOTH

### Tags
- Free-form labels stored in `tags` collection (id, name, createdAt)
- Transaction field `tags: List<String>` holds tag IDs (can be empty/null)
- Debt record field `tagIds: List<String>` holds tag IDs
- One transaction can have multiple tags; in tag-grouped analytics, it contributes to **each** tag's total
- MongoDB `.in(tagIds)` works on array fields for filtering
- Rename: safe operation since tags stored by ID, not name
- Merge support: replace source tag ID with target in transactions.tags and debt_records.tagIds arrays, handling deduplication

### People
- Counterparties for debt/loan tracking
- Fields: id, name (unique indexed), createdAt, updatedAt
- Can be deleted only if no open debt records reference them
- Person summary includes totalDebt, totalLoan, net balance with display-currency conversion

### Debt Records
- Track debts (I owe someone) and loans (someone owes me)
- Fields: id, personId, type (DEBT/LOAN), amount, coveredAmount, currency, categoryId, tagIds, description, date, status (OPEN/CLOSED), payments (embedded list), sourceTransactionId, deleted, createdAt, updatedAt
- Payments are embedded documents: id, amount, date, description, transactionId, offsetGroupId, createdAt
- Transactions can link to debt records via `debtLinks` field (List<DebtLink>: debtRecordId, paymentId, amount)
- Reconciliation: offset debts between two people across currencies with historical exchange rates
- Toggle status: manually open/close a debt record

### Event Log (Audit Trail)
- Records all entity changes: action (CREATE/UPDATE/DELETE), entityType, entityId, description, timestamp
- Paginated with backend filtering by entityType and date range (startDate, endDate)
- Endpoint: `GET /api/audit` (page, size, entityType, startDate, endDate)
- Frontend renders in Settings page with fixed-height table, page selector, and date filters

### Timestamps
- `LocalDate` for business date (user-selected)
- `Instant` for system timestamps (createdAt, updatedAt)

### Dashboard Analytics
- All chart endpoints accept optional filters: `accountIds`, `categoryIds`, `tagIds`, `types`
- `types` filter **gates inclusion** — if INCOME is not in the filter, income transactions are skipped entirely. It does NOT change the per-type query (always `.is(type)`, never `.in(types)`)
- `groupBy=category|tag` parameter on expenses-by-category and expense-trend endpoints
- Response uses generic `GroupExpenseResponse(id, name, amount)` for both category and tag grouping
- `ExpenseTrendResponse(period, groups: List<GroupExpenseResponse>)` — monthly breakdown
- Transfers crossing account filter boundary count as income/expense in income-vs-expenses chart
- Currency conversion uses historical rates for the transaction date within the selected range

### Import
- Bank statement import with preview → confirm flow
- Supported banks: Monobank, Millennium, Kredobank (card + account), MoneyManager
- Parser services detect bank format and extract transaction rows
- Preview endpoint returns parsed rows; confirm endpoint creates transactions
- Tags can be auto-created during import via `TagService.resolveTagNames()`

### Indexes (transactions)
- `{accountId: 1, date: -1}` — primary query pattern
- `{targetAccountId: 1, date: -1}` — transfers TO account
- `{accountId: 1, type: 1}` — filter by type
- `{categoryId: 1}` — analytics by category

## Auth
- HTTP Basic with BCrypt
- Credentials in `application.yml`, overridable via environment variables
- No JWT, no session management
