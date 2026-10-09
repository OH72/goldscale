# Engineering Principles

These rules apply to ALL code — backend and frontend.

## Core Principles

### KISS — Keep It Simple, Stupid
- Choose the simplest solution that works. If you can solve it in 10 lines, don't write 50.
- No premature abstractions. Three similar lines > one clever abstraction used once.
- No "just in case" code. Build for today's requirements, not imaginary future ones.

### SOLID
- **S** — Single Responsibility. One class/function does one thing.
- **O** — Open/Closed. Extend behavior without modifying existing code (use enums, strategy pattern).
- **L** — Liskov Substitution. Subtypes must be substitutable for their base types.
- **I** — Interface Segregation. Small, focused interfaces. Don't force implementations to depend on methods they don't use.
- **D** — Dependency Inversion. Depend on abstractions. Use constructor injection.

### DRY — Don't Repeat Yourself
- Extract repeated logic only when it's genuinely the same concept, not just similar-looking code.
- Shared constants, enums, and types belong in one place.
- BUT: duplication is better than the wrong abstraction. Don't DRY prematurely.

## Code Quality Rules

### Do NOT Overthink
- Solve the problem at hand. Don't design for hypothetical scenarios.
- If the requirement says "single user" — don't build multi-tenancy "just in case".
- If a simple `if/else` works — don't introduce a Strategy pattern for 2 cases.

### Error Handling
- Handle errors at the boundary (controller layer, API client). Don't catch-and-rethrow everywhere.
- Use specific exception types, not generic `RuntimeException`.
- Always return meaningful error messages to the frontend.
- Log errors with context (what was the input, what went wrong).

### Naming
- Names should reveal intent. `calculateBalanceDelta()` not `calc()`.
- Boolean variables/methods: `isDeleted`, `hasTransactions`, `canDelete`.
- Consistent naming across layers: if MongoDB field is `accountId`, Java field is `accountId`, TS type has `accountId`.

### Security
- Never log sensitive data (passwords, tokens).
- Validate all input at the controller/API boundary.
- Use parameterized queries (Spring Data handles this — don't build raw queries with string concatenation).
- Amounts are always validated as positive on input.

### Performance
- Don't optimize prematurely. Measure first.
- BUT: use proper indexes from day one (they're cheap to add, expensive to forget).
- Use `$inc` for balance updates, not read-modify-write.
- Paginate list endpoints. Never return unbounded collections.

## Bug Prevention

### Data Integrity
- All balance-modifying operations MUST be in `@Transactional` (MongoDB multi-document transaction).
- Transfer = 3 writes (save transaction + $inc source + $inc target) — all or nothing.
- Always validate that referenced documents exist before creating relationships (accountId, categoryId).
- INITIAL_BALANCE: exactly one per account, created atomically with the account.

### Common Pitfalls to Watch
- Floating point for money — NEVER. Use long (subunits) everywhere.
- Forgetting soft-delete filter — every transaction query must exclude deleted=true.
- Forgetting to update BOTH accounts on transfer edit/delete.
- Editing INITIAL_BALANCE — only amount can change, type and accountId are immutable.
- Category existence — INCOME/EXPENSE transaction must reference an existing category.
- Negative balance — allowed (overdraft). Don't block it.
- Missing `@Transactional` on operations that modify multiple documents.

### Missing Data Is Null, Not 0
- What: when a value cannot be computed (e.g. no exchange rate), expose it as `null` / `OptionalLong.empty()` and let the UI show a placeholder. Never substitute 0 in a per-item display field. Aggregates may skip missing items only where that is documented.
- Why: 0 looks like a real balance and silently misleads the user.
- Example: wrong `balanceInDisplayCurrency = rate == null ? 0 : amount * rate / dr`; right `converted.isPresent() ? converted.getAsLong() : null` (TS: `number | null`, render `-`).

### Filter vs Query Confusion
- What: when a filter narrows which categories of data to include, use it to **gate** (skip entirely) — not to change the query predicate. E.g., `types=[INCOME, EXPENSE]` means "only process income and expense"; it does NOT mean query `.in(types)`.
- Why: querying `.in(types)` in a method that expects a single type mixes all selected types together, producing wrong totals. This caused a real bug where selecting all three types inflated income/expense by counting transfers as both.
- Example: wrong: `Criteria.where("type").in(types)`; right: `if (!types.contains(type)) return List.of(); Criteria.where("type").is(type)`.

### Testing Mindset
- Test the happy path AND the edge cases.
- Key edge cases for this app:
  - Transfer between accounts with same currency (targetAmount = amount)
  - Transfer between accounts with different currencies
  - Editing a transaction to a different amount
  - Deleting a transfer (both balances must revert)
  - Deleting an account (all related transactions soft-deleted)
  - Creating account with zero initial balance

## Code Review Checklist
Before considering any code complete, verify:
- [ ] No hardcoded values that should be configurable
- [ ] Input validation present on public API endpoints
- [ ] Transactional boundaries correct for multi-document operations
- [ ] Soft-delete filter applied in all queries
- [ ] Amounts stored as long integers, not floating point
- [ ] Error responses follow consistent format
- [ ] No unused imports, dead code, or TODO comments left behind
- [ ] Every service method has unit tests AND integration tests for balance-modifying operations
- [ ] All tests pass before commit
