# GoldScale Changelog

Reverse-chronological list of features, fixes, and removals.

## 2026-10

- **feat** Merge categories and tags with cascading updates to transactions and debt records
- **feat** Event log: date filter, compact height, page selector
- **feat** Edit/rename tags with duplicate name validation
- **feat** Active/inactive filter on accounts page
- **feat** Fixed-height event log with backend pagination (10 items/page)
- **refactor** Move event log into settings page
- **feat** Search on tags, people, accounts; persist transaction filters in Zustand
- **feat** Manual debt/loan reconciliation with cross-currency support
- **feat** Audit log for all DB-impacting operations (event_log collection)
- **feat** Offset payments with group tracking and cascade delete
- **feat** Editable debt link amounts in transaction edit
- **feat** 1:N debt linking — one transaction can link to multiple debt records
- **feat** Bind transactions to debts/loans (debtLinks field)
- **remove** Mobile app (Expo/React Native) — permanently removed, web-only
- **feat** Category/tag search in debt record form
- **feat** Offset debts against loans per person per currency
- **feat** People page: debt/loan totals and sorting computed on backend
- **feat** Net worth on dashboard including debts and loans
- **feat** Debt summary by person on People page
- **feat** Debt/Loan system — people, debt records, payments, CRUD + toggle status
- **feat** Persist filter state in Zustand store with reset buttons
- **feat** BOTH category type, unique name constraint, search and type filter tabs
- **feat** Dashboard: group-by category/tag switcher, search in filter dropdowns
- **feat** Dashboard: category, tag, and transaction type filters
- **feat** Dark theme with chart color palettes (light vibrant, dark muted)

## 2026-09

- **feat** Bulk category delete with usage check
- **feat** Show balance in display currency on accounts page
- **feat** Dashboard charts: donut, income vs expense bar, net trend, exchange rates, expense trend
- **feat** Editable transfer accounts, category search, import incoming transfers
- **feat** Tags: management page, transaction tagging, tag filter
- **feat** Database backup and restore via Settings page
- **feat** Account active flag, USDT currency
- **feat** MoneyManager import parser, manual bank type selection
- **feat** Production Docker Compose with nginx frontend
- **feat** Pagination with page numbers and scroll preservation
- **feat** TRANSFER type support in import preview and confirm
- **feat** Date range filter and column sorting on transactions page
- **feat** Bank statement import: Monobank, Millennium, Kredobank (card + account)
- **feat** Import page with editable preview table
- **feat** Frontend: accounts, categories, transactions pages, dashboard, transaction form
- **feat** Cross-currency transfers with balance updates and edit/delete
- **feat** Transactions: income/expense with balance updates, filtering, pagination
- **feat** Categories CRUD with referential integrity
- **feat** Accounts CRUD with auto INITIAL_BALANCE and soft-delete cascade
- **feat** Backend foundation: Spring Boot, MongoDB, Basic Auth, Docker Compose
