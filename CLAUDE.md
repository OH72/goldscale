# GoldScale (MoneyManager)

Personal finance web application. Single-user, local-only deployment.

## Tech Stack

### Backend
- Java 21, Spring Boot 3, Spring MVC, Spring Data MongoDB (imperative)
- Spring Security: HTTP Basic Auth (credentials in application.yml)
- MongoDB with single-node Replica Set (Docker Compose)
- Maven, Docker

### Frontend
- React 19, TypeScript, Vite
- Tailwind CSS, Shadcn/ui
- TanStack Query (React Query) for server state
- Zustand for UI state
- React Router v7
- React Hook Form + Zod (forms/validation)
- TanStack Table (data tables)
- Recharts (charts)
- date-fns, sonner (toasts), react-error-boundary

## Architecture Decisions

### Data Model
- Collections: `accounts`, `categories`, `transactions`, `settings`
- NO `users` collection (single user, auth via config)
- Amounts stored as **integers in smallest currency unit** (kopiyky/cents). 12.34 UAH = 1234
- Balance is denormalized field on Account, updated with `$inc`
- TransactionType enum: INITIAL_BALANCE, INCOME, EXPENSE, TRANSFER
- Transfer = single document with accountId + targetAccountId + amount + targetAmount
- Amounts always positive, sign derived from type in business logic
- Exchange rate stored as derived field for display
- Soft delete (deleted flag) for transactions. INITIAL_BALANCE: editable, NOT deletable
- Categories: flat, user-created, typed (INCOME/EXPENSE). Cannot delete if transactions reference it
- BigDecimal mapped to Decimal128 in MongoDB
- LocalDate for business date, Instant for createdAt/updatedAt

### Indexes
- transactions: `{accountId: 1, date: -1}`, `{accountId: 1, type: 1}`, `{categoryId: 1}`
- All transaction queries filter by `{deleted: {$ne: true}}`

### Balance Logic
- Create: `$inc` balance by delta (positive for INCOME/INITIAL_BALANCE, negative for EXPENSE)
- Transfer: `$inc` source by -amount, target by +targetAmount
- Edit: `$inc` by (newDelta - oldDelta)
- Delete (soft): reverse the original `$inc`
- Audit endpoint: sum all active transactions vs stored balance

### Auth
- HTTP Basic, credentials in application.yml, BCrypt encoder
- No JWT, no sessions

### Frontend State Strategy
- Server data -> React Query
- UI state (sidebar, theme) -> Zustand
- Transaction filters -> URL search params
- Form data -> React Hook Form

## Conventions

### Git
- Commit format: `fix/feat/refactor/log/chore: <short description>`
- Author: 72nd <gemboleg@gmail.com>
- Incremental commits per logical unit of work

### Java
- Records for DTOs, sealed interfaces for command objects
- Enum for TransactionType, CategoryType, Currency
- Classes for @Document entities (not records)
- Package: com.goldscale

### Frontend
- Path alias: `@/` -> `src/`
- Query keys: hierarchical factory pattern
- API: centralized fetch wrapper
- Components in `components/`, pages in `pages/`
