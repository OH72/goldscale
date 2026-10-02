# GoldScale — Implementation Plan

## 1. Project Structure

```
goldscale/
├── backend/
│   ├── pom.xml
│   ├── Dockerfile
│   └── src/main/
│       ├── java/com/goldscale/
│       │   ├── GoldscaleApplication.java
│       │   ├── config/
│       │   │   ├── SecurityConfig.java
│       │   │   └── MongoConfig.java
│       │   ├── model/
│       │   │   ├── Account.java
│       │   │   ├── Category.java
│       │   │   ├── Transaction.java
│       │   │   ├── Settings.java
│       │   │   ├── TransactionType.java      # enum
│       │   │   ├── CategoryType.java          # enum (INCOME, EXPENSE)
│       │   │   └── Currency.java              # enum (UAH, USD, EUR)
│       │   ├── dto/
│       │   │   ├── request/
│       │   │   │   ├── CreateAccountRequest.java    # record
│       │   │   │   ├── UpdateAccountRequest.java    # record
│       │   │   │   ├── CreateCategoryRequest.java   # record
│       │   │   │   ├── UpdateCategoryRequest.java   # record
│       │   │   │   ├── TransactionCommand.java      # sealed interface
│       │   │   │   └── UpdateTransactionRequest.java # record
│       │   │   └── response/
│       │   │       ├── AccountResponse.java         # record
│       │   │       ├── CategoryResponse.java        # record
│       │   │       ├── TransactionResponse.java     # record
│       │   │       ├── DashboardResponse.java       # record
│       │   │       └── ErrorResponse.java           # record
│       │   ├── repository/
│       │   │   ├── AccountRepository.java
│       │   │   ├── CategoryRepository.java
│       │   │   └── TransactionRepository.java
│       │   ├── service/
│       │   │   ├── AccountService.java
│       │   │   ├── CategoryService.java
│       │   │   ├── TransactionService.java
│       │   │   └── BalanceService.java
│       │   ├── controller/
│       │   │   ├── AccountController.java
│       │   │   ├── CategoryController.java
│       │   │   ├── TransactionController.java
│       │   │   └── DashboardController.java
│       │   └── exception/
│       │       ├── GlobalExceptionHandler.java
│       │       ├── ResourceNotFoundException.java
│       │       └── BusinessRuleException.java
│       └── resources/
│           └── application.yml
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── main.tsx
│       ├── app.tsx
│       ├── router.tsx
│       ├── index.css
│       ├── api/
│       │   ├── client.ts
│       │   ├── query-keys.ts
│       │   ├── use-accounts.ts
│       │   ├── use-categories.ts
│       │   ├── use-transactions.ts
│       │   └── use-dashboard.ts
│       ├── components/
│       │   ├── ui/           # shadcn generated
│       │   ├── layout/
│       │   │   ├── root-layout.tsx
│       │   │   ├── sidebar.tsx
│       │   │   └── page-header.tsx
│       │   ├── currency-display.tsx
│       │   ├── date-display.tsx
│       │   ├── transaction-badge.tsx
│       │   └── confirm-dialog.tsx
│       ├── pages/
│       │   ├── dashboard.tsx
│       │   ├── accounts.tsx
│       │   ├── transactions.tsx
│       │   ├── transaction-form.tsx
│       │   ├── categories.tsx
│       │   └── analytics.tsx
│       ├── stores/
│       │   └── ui-store.ts
│       ├── types/
│       │   ├── account.ts
│       │   ├── category.ts
│       │   ├── transaction.ts
│       │   └── common.ts
│       └── lib/
│           ├── utils.ts      # shadcn cn()
│           ├── currency.ts
│           └── date.ts
├── docker-compose.yml
├── .gitignore
├── CLAUDE.md
└── PLAN.md
```

---

## 2. MongoDB Document Schemas

### accounts
```json
{
  "_id": ObjectId,
  "name": "Monobank UAH",
  "currency": "UAH",
  "balance": NumberLong(1523400),    // 15234.00 UAH in kopiyky
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```
Indexes: `{name: 1}` (unique)

### categories
```json
{
  "_id": ObjectId,
  "name": "Groceries",
  "type": "EXPENSE",                // INCOME | EXPENSE
  "icon": "shopping-cart",           // optional, for UI
  "createdAt": ISODate
}
```
Indexes: `{name: 1, type: 1}` (unique compound)

### transactions
```json
{
  "_id": ObjectId,
  "type": "EXPENSE",                 // INITIAL_BALANCE | INCOME | EXPENSE | TRANSFER
  "accountId": ObjectId,             // source account (always set)
  "targetAccountId": ObjectId,       // only for TRANSFER
  "categoryId": ObjectId,            // null for TRANSFER and INITIAL_BALANCE
  "amount": NumberLong(50000),       // 500.00 in source currency smallest unit
  "targetAmount": NumberLong(1350),  // only for cross-currency TRANSFER (in target currency)
  "exchangeRate": 0.027,             // derived: targetAmount/amount, only for cross-currency
  "description": "Weekly groceries",
  "date": "2026-10-01",             // business date (LocalDate)
  "deleted": false,
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```
Indexes:
- `{accountId: 1, date: -1}`
- `{accountId: 1, type: 1}`
- `{categoryId: 1}`
- `{targetAccountId: 1, date: -1}` (for finding transfers TO an account)
- `{deleted: 1}` (partial index where deleted=true)

### settings
```json
{
  "_id": ObjectId,
  "defaultCurrency": "UAH",
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

---

## 3. Java Domain Model

### Enums
```java
public enum TransactionType {
    INITIAL_BALANCE, INCOME, EXPENSE, TRANSFER
}

public enum CategoryType {
    INCOME, EXPENSE
}

public enum Currency {
    UAH(100), USD(100), EUR(100), PLN(100), GBP(100), JPY(1);

    private final int subunits;
    Currency(int subunits) { this.subunits = subunits; }
    public int getSubunits() { return subunits; }
}
```

### Entities (classes, not records)
```java
@Document("accounts")
public class Account {
    @Id private String id;
    private String name;
    private Currency currency;
    private long balance;          // in smallest currency unit
    private Instant createdAt;
    private Instant updatedAt;
}

@Document("transactions")
@CompoundIndex(name = "account_date_idx", def = "{'accountId': 1, 'date': -1}")
@CompoundIndex(name = "account_type_idx", def = "{'accountId': 1, 'type': 1}")
public class Transaction {
    @Id private String id;
    private TransactionType type;
    private String accountId;
    private String targetAccountId;    // TRANSFER only
    private String categoryId;         // null for TRANSFER, INITIAL_BALANCE
    private long amount;               // always positive, in source currency subunits
    private Long targetAmount;         // TRANSFER only, in target currency subunits
    private Double exchangeRate;       // cross-currency TRANSFER only
    private String description;
    private LocalDate date;
    private boolean deleted;
    private Instant createdAt;
    private Instant updatedAt;
}
```

### DTO Records
```java
// Requests
public record CreateAccountRequest(
    @NotBlank String name,
    @NotNull Currency currency,
    @NotNull @Min(0) Long initialBalance  // in subunits
) {}

public record UpdateAccountRequest(
    @NotBlank String name
) {}

public record CreateCategoryRequest(
    @NotBlank String name,
    @NotNull CategoryType type,
    String icon
) {}

// Sealed interface for transaction creation
public sealed interface TransactionCommand {
    record CreateIncome(
        @NotNull String accountId,
        @NotNull @Min(1) Long amount,
        @NotNull String categoryId,
        @NotNull LocalDate date,
        String description
    ) implements TransactionCommand {}

    record CreateExpense(
        @NotNull String accountId,
        @NotNull @Min(1) Long amount,
        @NotNull String categoryId,
        @NotNull LocalDate date,
        String description
    ) implements TransactionCommand {}

    record CreateTransfer(
        @NotNull String sourceAccountId,
        @NotNull String targetAccountId,
        @NotNull @Min(1) Long amount,
        @NotNull @Min(1) Long targetAmount,
        @NotNull LocalDate date,
        String description
    ) implements TransactionCommand {}
}

// Responses
public record AccountResponse(
    String id, String name, Currency currency,
    long balance, Instant createdAt
) {}

public record TransactionResponse(
    String id, TransactionType type,
    String accountId, String accountName,
    String targetAccountId, String targetAccountName,
    String categoryId, String categoryName,
    long amount, Long targetAmount, Double exchangeRate,
    String description, LocalDate date, Instant createdAt
) {}

public record DashboardResponse(
    List<AccountResponse> accounts,
    long totalBalanceDefaultCurrency,
    List<TransactionResponse> recentTransactions
) {}

public record ErrorResponse(
    int status, String message, Instant timestamp
) {}
```

### Balance Delta Calculation
```java
// In BalanceService
public long calculateDelta(TransactionType type, long amount) {
    return switch (type) {
        case INCOME, INITIAL_BALANCE -> amount;
        case EXPENSE -> -amount;
        case TRANSFER -> throw new IllegalArgumentException("Use transfer-specific logic");
    };
}
```

---

## 4. REST API Specification

Base path: `/api`

### Accounts
| Method | Path | Request Body | Response | Description |
|--------|------|-------------|----------|-------------|
| GET | /accounts | - | AccountResponse[] | List all |
| GET | /accounts/{id} | - | AccountResponse | Get by ID |
| POST | /accounts | CreateAccountRequest | AccountResponse | Create + INITIAL_BALANCE txn |
| PUT | /accounts/{id} | UpdateAccountRequest | AccountResponse | Update name |
| DELETE | /accounts/{id} | - | 204 | Delete account + all its txns |

### Categories
| Method | Path | Request Body | Response | Description |
|--------|------|-------------|----------|-------------|
| GET | /categories | ?type=INCOME/EXPENSE | CategoryResponse[] | List (optionally by type) |
| GET | /categories/{id} | - | CategoryResponse | Get by ID |
| POST | /categories | CreateCategoryRequest | CategoryResponse | Create |
| PUT | /categories/{id} | UpdateCategoryRequest | CategoryResponse | Update |
| DELETE | /categories/{id} | - | 204 | Delete (fails if txns reference it) |

### Transactions
| Method | Path | Request Body | Response | Description |
|--------|------|-------------|----------|-------------|
| GET | /transactions | ?accountId&type&categoryId&startDate&endDate&page&size | Page<TransactionResponse> | List with filters |
| GET | /transactions/{id} | - | TransactionResponse | Get by ID |
| POST | /transactions | TransactionCommand (JSON with `type` discriminator) | TransactionResponse | Create |
| PUT | /transactions/{id} | UpdateTransactionRequest | TransactionResponse | Update |
| DELETE | /transactions/{id} | - | 204 | Soft delete |

### Dashboard
| Method | Path | Request Body | Response | Description |
|--------|------|-------------|----------|-------------|
| GET | /dashboard | - | DashboardResponse | Balances + recent txns |

### Balance Audit
| Method | Path | Request Body | Response | Description |
|--------|------|-------------|----------|-------------|
| POST | /accounts/{id}/audit | - | AuditResponse | Verify & fix balance |

### Error Response Format
```json
{
  "status": 400,
  "message": "Category has 15 transactions and cannot be deleted",
  "timestamp": "2026-10-02T12:00:00Z"
}
```

---

## 5. Service Layer Business Logic

### AccountService
```
createAccount(req):
  1. Save Account(name, currency, balance=req.initialBalance)
  2. Save Transaction(type=INITIAL_BALANCE, accountId=account.id,
     amount=req.initialBalance, date=today)
  3. Return account
  -- Both in @Transactional

deleteAccount(id):
  1. Soft-delete all transactions for this account
  2. Soft-delete all transactions where targetAccountId=this account
  3. Delete the account document
  -- All in @Transactional
```

### TransactionService — Create
```
createTransaction(command):
  switch (command):
    case CreateIncome(accountId, amount, categoryId, date, desc):
      1. Validate account exists
      2. Validate category exists and type=INCOME
      3. Save Transaction(type=INCOME, ...)
      4. $inc account.balance by +amount

    case CreateExpense(accountId, amount, categoryId, date, desc):
      1. Validate account exists
      2. Validate category exists and type=EXPENSE
      3. Save Transaction(type=EXPENSE, ...)
      4. $inc account.balance by -amount

    case CreateTransfer(sourceAccountId, targetAccountId, amount, targetAmount, date, desc):
      1. Validate both accounts exist
      2. Calculate exchangeRate = targetAmount / amount (as double)
      3. Save Transaction(type=TRANSFER, accountId=source, targetAccountId=target,
         amount, targetAmount, exchangeRate)
      4. $inc source.balance by -amount
      5. $inc target.balance by +targetAmount
  -- All in @Transactional
```

### TransactionService — Update
```
updateTransaction(id, req):
  1. Find existing transaction (must not be deleted)
  2. If INITIAL_BALANCE: only amount can change
  3. Calculate old delta and new delta
  4. Reverse old balance effect, apply new balance effect via $inc
  5. For TRANSFER: reverse both accounts, apply both new deltas
  6. Update transaction fields
  -- All in @Transactional
```

### TransactionService — Soft Delete
```
deleteTransaction(id):
  1. Find transaction (must not be deleted, must not be INITIAL_BALANCE)
  2. Set deleted=true
  3. Reverse balance effect:
     - INCOME: $inc account.balance by -amount
     - EXPENSE: $inc account.balance by +amount
     - TRANSFER: $inc source.balance by +amount, $inc target.balance by -targetAmount
  -- All in @Transactional
```

### BalanceService — Audit
```
auditBalance(accountId):
  1. Sum all non-deleted transactions affecting this account:
     - as accountId: +INCOME, +INITIAL_BALANCE, -EXPENSE, -TRANSFER(amount)
     - as targetAccountId: +TRANSFER(targetAmount)
  2. Compare with stored account.balance
  3. If mismatch: update balance to calculated value, return diff
  4. If match: return OK
```

### Filtering (TransactionService)
```
Query criteria (all optional, AND logic):
  - accountId: where accountId=X OR targetAccountId=X
  - type: where type=X
  - categoryId: where categoryId=X
  - startDate/endDate: where date >= start AND date <= end
  - ALWAYS: where deleted != true
Sort: date DESC, createdAt DESC
Pagination: Spring Pageable (page, size)
```

---

## 6. Frontend Pages & Components

### Dashboard (`/`)
```
DashboardPage
├── PageHeader("Dashboard")
├── AccountBalanceCards          # grid of cards, one per account
│   └── AccountCard             # name, balance (formatted), currency
├── TotalBalance                # sum in default currency (if all same currency)
└── RecentTransactionsList      # last 10 transactions
    └── TransactionRow          # date, type badge, amount, account, category
```

### Accounts (`/accounts`)
```
AccountsPage
├── PageHeader("Accounts") + AddButton
├── AccountsTable               # TanStack Table
│   └── columns: Name, Currency, Balance, Actions(edit/delete)
└── AccountDialog               # shadcn Dialog with form
    └── Form: name(input), currency(select), initialBalance(input, only on create)
```

### Transactions (`/transactions`)
```
TransactionsPage
├── PageHeader("Transactions") + AddButton
├── FiltersBar                   # account select, type select, category select, date range
├── TransactionsTable            # TanStack Table with pagination
│   └── columns: Date, Type(badge), Account, Category, Amount, Description, Actions
└── Links to /transactions/new and /transactions/:id/edit
```

### Transaction Form (`/transactions/new`, `/transactions/:id/edit`)
```
TransactionFormPage
├── PageHeader("Add/Edit Transaction")
└── TransactionForm
    ├── TypeSelector              # INCOME | EXPENSE | TRANSFER tabs/toggle
    ├── AccountSelect             # source account
    ├── TargetAccountSelect       # only for TRANSFER
    ├── AmountInput               # number input, displays in currency subunits / 100
    ├── TargetAmountInput         # only for cross-currency TRANSFER
    ├── ExchangeRateDisplay       # read-only calculated field
    ├── CategorySelect            # filtered by type (INCOME/EXPENSE), hidden for TRANSFER
    ├── DatePicker
    ├── DescriptionInput
    └── SubmitButton
```

### Categories (`/categories`)
```
CategoriesPage
├── PageHeader("Categories") + AddButton
├── Tabs: Income | Expense
├── CategoriesGrid/List          # cards or list grouped by type
│   └── CategoryCard             # name, icon, edit/delete actions
└── CategoryDialog               # create/edit form
    └── Form: name(input), type(select), icon(select)
```

---

## 7. Docker & Infrastructure

### docker-compose.yml
```yaml
services:
  mongodb:
    image: mongo:7
    command: ["--replSet", "rs0", "--bind_ip_all"]
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    healthcheck:
      test: >
        mongosh --quiet --eval "
          try { rs.status().ok } catch(e) { rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]}).ok }
        "
      interval: 5s
      timeout: 10s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      SPRING_DATA_MONGODB_URI: mongodb://mongodb:27017/goldscale?replicaSet=rs0
      APP_AUTH_USERNAME: admin
      APP_AUTH_PASSWORD: admin
    depends_on:
      mongodb:
        condition: service_healthy

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  mongodb_data:
```

### Backend Dockerfile
```dockerfile
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:21-jre
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Frontend Dockerfile
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
```

### nginx.conf
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass http://backend:8080;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Vite dev proxy (vite.config.ts)
```typescript
server: {
  proxy: {
    '/api': { target: 'http://localhost:8080', changeOrigin: true }
  }
}
```

---

## 8. Development Roadmap

### Sprint 1: Project Foundation
**Goal:** Running backend + MongoDB in Docker, health check endpoint.

Files to create:
- `docker-compose.yml`
- `.gitignore`
- `backend/pom.xml`
- `backend/Dockerfile`
- `backend/src/main/java/com/goldscale/GoldscaleApplication.java`
- `backend/src/main/resources/application.yml`
- `backend/src/main/java/com/goldscale/config/SecurityConfig.java`
- `backend/src/main/java/com/goldscale/config/MongoConfig.java`
- `backend/src/main/java/com/goldscale/exception/GlobalExceptionHandler.java`
- `backend/src/main/java/com/goldscale/exception/ResourceNotFoundException.java`
- `backend/src/main/java/com/goldscale/exception/BusinessRuleException.java`

Verify: `docker compose up`, curl `localhost:8080/api/health` returns 200 with Basic Auth.

### Sprint 2: Accounts (Backend)
**Goal:** Full accounts CRUD with INITIAL_BALANCE auto-creation.

Files to create:
- `backend/src/.../model/Account.java`
- `backend/src/.../model/Currency.java`
- `backend/src/.../model/TransactionType.java`
- `backend/src/.../model/Transaction.java`
- `backend/src/.../dto/request/CreateAccountRequest.java`
- `backend/src/.../dto/request/UpdateAccountRequest.java`
- `backend/src/.../dto/response/AccountResponse.java`
- `backend/src/.../dto/response/ErrorResponse.java`
- `backend/src/.../repository/AccountRepository.java`
- `backend/src/.../repository/TransactionRepository.java`
- `backend/src/.../service/AccountService.java`
- `backend/src/.../service/BalanceService.java`
- `backend/src/.../controller/AccountController.java`

Verify: curl CRUD operations on `/api/accounts`, check MongoDB documents.

### Sprint 3: Categories (Backend)
**Goal:** Categories CRUD with referential integrity.

Files to create:
- `backend/src/.../model/Category.java`
- `backend/src/.../model/CategoryType.java`
- `backend/src/.../dto/request/CreateCategoryRequest.java`
- `backend/src/.../dto/request/UpdateCategoryRequest.java`
- `backend/src/.../dto/response/CategoryResponse.java`
- `backend/src/.../repository/CategoryRepository.java`
- `backend/src/.../service/CategoryService.java`
- `backend/src/.../controller/CategoryController.java`

Verify: curl CRUD, try deleting category with transactions — expect 409.

### Sprint 4: Transactions — Income/Expense (Backend)
**Goal:** Create/edit/soft-delete income and expense, balance updates.

Files to create:
- `backend/src/.../dto/request/TransactionCommand.java`
- `backend/src/.../dto/request/UpdateTransactionRequest.java`
- `backend/src/.../dto/response/TransactionResponse.java`
- `backend/src/.../service/TransactionService.java`
- `backend/src/.../controller/TransactionController.java`

Verify: Create income/expense, check balance updates. Edit — check delta. Soft delete — check reversal. Filter by account, type, date range.

### Sprint 5: Transfers + Dashboard (Backend)
**Goal:** Cross-currency transfers, dashboard endpoint, balance audit.

Files to create/modify:
- Extend `TransactionService` with transfer logic
- Extend `TransactionCommand` with `CreateTransfer`
- `backend/src/.../dto/response/DashboardResponse.java`
- `backend/src/.../controller/DashboardController.java`

Verify: Create same-currency and cross-currency transfers. Check both balances update. Dashboard returns all data. Audit endpoint works.

### Sprint 6: Frontend Foundation
**Goal:** React project init, routing, layout, API client, Shadcn setup.

Files to create:
- `frontend/` — full Vite + React 19 + TS project
- Shadcn/ui init + core components (button, input, select, dialog, table, card, form, tabs, dropdown-menu, badge, separator, sheet, sonner, calendar, popover)
- `src/app.tsx`, `src/router.tsx`, `src/main.tsx`, `src/index.css`
- `src/api/client.ts`, `src/api/query-keys.ts`
- `src/components/layout/root-layout.tsx`, `sidebar.tsx`, `page-header.tsx`
- `src/stores/ui-store.ts`
- `src/types/` — all type definitions
- `src/lib/currency.ts`, `src/lib/date.ts`
- `frontend/nginx.conf`, `frontend/Dockerfile`

Verify: `npm run dev`, navigate between pages (empty), sidebar works.

### Sprint 7: Frontend — Accounts & Categories
**Goal:** Working accounts and categories pages.

Files to create:
- `src/api/use-accounts.ts`, `src/api/use-categories.ts`
- `src/pages/accounts.tsx` — table + create/edit dialog
- `src/pages/categories.tsx` — list by type + create/edit dialog
- `src/components/confirm-dialog.tsx`

Verify: Create/edit/delete accounts and categories through the UI.

### Sprint 8: Frontend — Transactions
**Goal:** Transaction list with filters, create/edit form, dashboard.

Files to create:
- `src/api/use-transactions.ts`, `src/api/use-dashboard.ts`
- `src/pages/transactions.tsx` — filtered table with pagination
- `src/pages/transaction-form.tsx` — form with type switcher
- `src/pages/dashboard.tsx` — balance cards + recent transactions
- `src/components/currency-display.tsx`
- `src/components/date-display.tsx`
- `src/components/transaction-badge.tsx`

Verify: Full flow — create account, add categories, create transactions (income/expense/transfer), view dashboard, filter transactions.

---

## 9. Verification Checklist

### Business Logic Tests
- [ ] Create account -> INITIAL_BALANCE transaction created, balance set
- [ ] Income -> balance increases by exact amount
- [ ] Expense -> balance decreases by exact amount
- [ ] Transfer (same currency) -> source decreases, target increases
- [ ] Transfer (cross-currency) -> source decreases by amount, target increases by targetAmount
- [ ] Edit income amount 500->300 -> balance decreases by 200
- [ ] Soft delete expense -> balance increases (reversal)
- [ ] Cannot delete INITIAL_BALANCE
- [ ] Cannot delete category with transactions
- [ ] Audit endpoint detects and fixes balance mismatch
- [ ] All queries exclude soft-deleted transactions
- [ ] Filters work: by account (includes transfers TO it), by type, by category, by date range
- [ ] Pagination works with sorting by date DESC

### Frontend Tests
- [ ] All CRUD operations work through UI
- [ ] Transaction form adapts to type (shows/hides fields)
- [ ] Cross-currency transfer shows two amount fields + calculated rate
- [ ] Filters update URL params and survive page refresh
- [ ] Toast notifications on success/error
- [ ] Currency formatting correct (kopiyky -> hryvnia display)
- [ ] Dashboard shows current balances and recent transactions
