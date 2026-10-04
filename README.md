# GoldScale

Personal finance web application for tracking accounts, transactions, and budgets. Single-user, self-hosted via Docker Compose. Supports importing bank statements from multiple Ukrainian and Polish banks.

## Features

- **Accounts** -- manage bank accounts with multi-currency support (UAH, USD, EUR, PLN, GBP, USDT) and real-time balance tracking
- **Transactions** -- income, expense, and transfer operations with pagination, filtering by account/type/category/tag/date range
- **Transfers** -- move money between accounts with automatic cross-currency exchange rate calculation
- **Categories** -- typed income/expense categories for organizing transactions
- **Tags** -- flexible labeling system for transactions
- **Bank statement import** -- upload PDF/CSV statements with preview and selective import; supported banks:
  - Monobank
  - Millennium Bank
  - Kredobank (card and account statements)
  - MoneyManager (CSV export)
- **Dashboard** -- summary view with account balances and spending analytics
- **Backup / Restore** -- full database export as ZIP and restore from backup
- **Balance audit** -- per-account integrity check that recalculates balance from transaction history
- **Settings** -- default currency configuration

## Tech Stack

### Backend

| Component | Version |
|-----------|---------|
| Java | 21 |
| Spring Boot | 3.4 |
| Spring Data MongoDB | Imperative (not reactive) |
| Spring Security | HTTP Basic with BCrypt |
| MongoDB | 7 (replica set for transactions) |
| Apache PDFBox | 3.0 (PDF statement parsing) |
| Lombok | Entities only |
| Build tool | Maven |

### Frontend

| Component | Version |
|-----------|---------|
| React | 19 |
| TypeScript | 6 |
| Vite | 8 |
| Tailwind CSS | 4 |
| Shadcn/ui | Component library |
| TanStack Query | Server state management |
| TanStack Table | Data tables |
| Zustand | Client UI state |
| React Router | 7 |
| React Hook Form + Zod | Forms and validation |
| Recharts | Charts |

### Testing

- Unit tests with Mockito
- Integration tests with Testcontainers (MongoDB)

## Project Structure

```
goldscale/
├── backend/
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/main/java/com/goldscale/
│       ├── config/          # SecurityConfig, MongoConfig
│       ├── controller/      # REST controllers
│       ├── dto/             # Request/response records
│       ├── exception/       # Global error handling
│       ├── model/           # MongoDB entities, enums
│       ├── repository/      # Spring Data MongoDB repos
│       └── service/
│           ├── parser/      # Bank statement parsers
│           └── ...          # Business logic services
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf           # Production reverse proxy config
│   ├── vite.config.ts
│   └── src/
│       ├── api/             # API client, query hooks, query keys
│       ├── components/      # UI components, layout, shadcn/ui
│       ├── pages/           # Route pages
│       ├── stores/          # Zustand stores
│       ├── types/           # TypeScript types + Zod schemas
│       ├── lib/             # Utilities (currency, date, cn)
│       └── router.tsx       # Route definitions
├── docker-compose.yml       # Dev: MongoDB + backend
└── docker-compose.prod.yml  # Prod: MongoDB + backend + frontend (nginx)
```

## Prerequisites

- Docker and Docker Compose
- Node.js 22+ and npm (for frontend development)
- Java 21 and Maven (only if running backend outside Docker)

## Development Setup

The dev setup runs MongoDB and the backend in Docker, while the frontend runs locally with Vite's dev server for hot reload.

### 1. Start backend and database

```bash
docker compose up -d
```

This starts:
- **MongoDB 7** on port `27017` (single-node replica set for transaction support)
- **Backend** on port `8080`

### 2. Start frontend dev server

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` with Vite proxying all `/api/*` requests to the backend at `localhost:8080`.

### 3. Open the app

Navigate to `http://localhost:5173`. Default credentials: `admin` / `admin`.

## Production Deployment

The production setup runs everything in Docker with nginx serving the frontend and proxying API requests.

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This starts:
- **MongoDB 7** (internal, no exposed port)
- **Backend** on port `8080`
- **Frontend (nginx)** on port `3000`, proxying `/api/` to the backend

Navigate to `http://localhost:3000`. Default credentials: `admin` / `admin`.

## Configuration

### Environment Variables

Set these in the `docker-compose.yml` or `docker-compose.prod.yml` `environment` section for the backend service:

| Variable | Default | Description |
|----------|---------|-------------|
| `SPRING_DATA_MONGODB_URI` | `mongodb://localhost:27017/goldscale?replicaSet=rs0` | MongoDB connection string |
| `APP_AUTH_USERNAME` | `admin` | HTTP Basic auth username |
| `APP_AUTH_PASSWORD` | `admin` | HTTP Basic auth password (stored with BCrypt) |

### Backend application.yml

```yaml
spring:
  data:
    mongodb:
      uri: mongodb://localhost:27017/goldscale?replicaSet=rs0
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 10MB

app:
  auth:
    username: admin
    password: admin
```

The MongoDB connection must include `?replicaSet=rs0` for multi-document transaction support.

## API Overview

All endpoints are under `/api` and require HTTP Basic authentication.

### Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts` | List all accounts |
| GET | `/api/accounts/{id}` | Get account by ID |
| POST | `/api/accounts` | Create account (with initial balance) |
| PUT | `/api/accounts/{id}` | Update account |
| DELETE | `/api/accounts/{id}` | Delete account (soft-deletes all transactions) |
| POST | `/api/accounts/{id}/audit` | Audit and fix account balance |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List transactions (paginated, filterable) |
| GET | `/api/transactions/{id}` | Get transaction by ID |
| POST | `/api/transactions` | Create transaction (income/expense/transfer) |
| PUT | `/api/transactions/{id}` | Update transaction |
| DELETE | `/api/transactions/{id}` | Soft-delete transaction |

Query parameters for `GET /api/transactions`: `accountId`, `type`, `categoryId`, `tagId`, `startDate`, `endDate`, `page`, `size`.

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List categories (optional `?type=INCOME\|EXPENSE`) |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/{id}` | Update category |
| DELETE | `/api/categories/{id}` | Delete category (fails if transactions exist) |

### Tags

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tags` | List all tags |
| POST | `/api/tags` | Create tag |
| DELETE | `/api/tags/{id}` | Delete tag |

### Import

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/import/preview` | Upload bank statement, get parsed preview |
| POST | `/api/import/confirm` | Confirm and import selected transactions |

### Backup

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/backup` | Export full database as ZIP |
| POST | `/api/backup/restore` | Restore database from ZIP backup |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Dashboard summary data |
| GET | `/api/health` | Health check |

## Data Model Notes

- **Amounts** are stored as long integers in the smallest currency unit (e.g., 1234 = 12.34 UAH). The frontend divides by 100 for display.
- **Soft delete** -- transactions are never physically removed; they are marked with `deleted: true`.
- **Transfers** are single documents with `accountId` (source), `targetAccountId` (target), `amount` (source currency), and `targetAmount` (target currency).
- **Balance** is denormalized on the account and updated atomically with MongoDB `$inc` operations inside multi-document transactions.
