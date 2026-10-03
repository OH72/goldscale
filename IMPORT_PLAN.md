# Bank Statement Import — Implementation Plan

## Overview

Upload PDF bank statements, parse transactions, let the user review/edit each one before saving.
All parsed transactions default to INCOME or EXPENSE. User manually converts to TRANSFER if needed.

## Supported Banks

### 1. Monobank (UAH card)
- **Format:** Table with columns: Date/time, Description, MCC, Card currency amount (UAH), Operation amount, Operation currency, Exchange rate, Commission, Cashback, Balance
- **Currency:** UAH (card currency), operations in PLN/USD/EUR
- **Amount field:** "Card currency amount (UAH)" — negative = expense, positive = income
- **Category hint:** Description field ("Products and supermarkets", "Cafes and restaurants", "Travel", etc.)
- **Skip rows:** None — all are real transactions (card top-ups are income)
- **Date format:** `DD.MM.YYYY HH:mm:ss` — use explicit `DateTimeFormatter`

### 2. Kredobank Account (UAH)
- **Format:** Table with columns: Date, Document number, Operation details, Amount
- **Currency:** UAH
- **Amount field:** Negative = expense/outgoing, positive = income
- **Category hint:** Operation details text
- **Skip rows:** Commission rows (can be imported as expenses)
- **Date format:** `DD.MM.YYYY` — use explicit `DateTimeFormatter`

### 3. Kredobank Card (UAH)
- **Format:** Table with columns: Date, Document number, Operation details, Amount
- **Currency:** UAH
- **Amount field:** Always negative (expenses + conversion commissions)
- **Category hint:** Operation details contain merchant names embedded in POS terminal strings
- **Pair rows:** Each purchase has a matching "Комісія за конвертацію" row — treat as separate expense
- **Date format:** `DD.MM.YYYY` — use explicit `DateTimeFormatter`

### 4. Millennium (PLN)
- **Format:** Table with columns: Post date, Value date, Transaction description, Value, Balance
- **Currency:** PLN
- **Amount field:** Positive = income, negative = expense
- **Category hint:** Transaction description (PRZEKAZ SEPA, PRZELEW PRZYCHODZĄCY, etc.)
- **Date format:** `YYYY-MM-DD` — use explicit `DateTimeFormatter`

## Data Flow

```
PDF Upload → Backend Parse → Preview List → User Edit/Confirm → Save Transactions
```

1. **Upload:** User selects PDF + target account from UI
2. **Parse:** Backend extracts text from PDF, detects bank format, parses rows into `ImportRow[]`
3. **Preview:** Frontend displays parsed transactions in an editable table
4. **Edit:** User can change type (INCOME↔EXPENSE), amount, category, description, date, or remove rows
5. **Confirm:** User clicks "Import N transactions" — frontend sends final list to `POST /api/import/confirm`
6. **Save:** Backend creates transactions + updates balances in a single `@Transactional` block

## Backend

### Dependencies
- `org.apache.pdfbox:pdfbox:3.0.4` — PDF text extraction
- Pin version in `<properties>`: `<pdfbox.version>3.0.4</pdfbox.version>`

### Configuration
```yaml
spring:
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 10MB
```

### New Files
- `service/ImportService.java` — orchestrates parse + save
- `service/parser/StatementParser.java` — interface for bank-specific parsers
- `service/parser/MonobankParser.java`
- `service/parser/KredobankAccountParser.java`
- `service/parser/KredobankCardParser.java`
- `service/parser/MillenniumParser.java`
- `service/parser/ParserDetector.java` — auto-detect bank from PDF text
- `dto/request/ImportConfirmRequest.java` — list of confirmed transactions
- `dto/response/ImportPreviewResponse.java` — parsed rows for preview
- `dto/response/ImportRow.java` — single parsed row
- `dto/response/ImportConfirmResponse.java` — result with imported + skipped counts
- `controller/ImportController.java`

### API Endpoints

```
POST /api/import/preview
  Content-Type: multipart/form-data
  Params: file (PDF), accountId (target account)
  Response: ImportPreviewResponse { rows: ImportRow[], bankName: string, detectedCurrency: string }

POST /api/import/confirm
  Body: @Valid ImportConfirmRequest { accountId: string, rows: List<@Valid ConfirmRow> }
  Response: ImportConfirmResponse { imported: int, skipped: int }
```

### ImportRow (preview response)
```java
public record ImportRow(
    int index,
    TransactionType type,  // INCOME or EXPENSE (enum, not String)
    long amount,           // in account currency subunits (always positive)
    LocalDate date,
    String description,    // from statement
    String categoryHint,   // suggested category name from MCC/description, nullable
    String sourceRef       // hash of date+amount+description for duplicate detection
) {}
```

### ConfirmRow (confirm request)
```java
public record ConfirmRow(
    @NotNull TransactionType type,  // INCOME or EXPENSE (enum, not String)
    @NotNull @Min(1) Long amount,   // must be positive, reject zero-amount rows
    @NotNull LocalDate date,
    String description,
    String categoryId,              // user-selected category, nullable
    String sourceRef                // for duplicate detection
) {}
```

### Error Handling
- `MaxUploadSizeExceededException` → 400 "File too large. Maximum allowed size is 10 MB."
- Validate content type is `application/pdf` and file is non-empty in `ImportService.preview()`
- Unknown bank format → 400 "Unsupported bank statement format"

### Parser Logic
Each parser implements:
```java
public interface StatementParser {
    boolean canParse(String pdfText);
    List<ImportRow> parse(String pdfText);
}
```

- `ParserDetector` tries each parser's `canParse()` against the extracted text
- `canParse()` checks for bank-specific markers (e.g., "monobank", "KredoBank", "Millennium")
- `parse()` extracts rows using regex/string splitting on the text content
- Use `PDFTextStripper` with `setSortByPosition(true)` if Cyrillic is garbled
- Each parser uses explicit `DateTimeFormatter` — never rely on `LocalDate.parse()` defaults

### Amount Parsing Rules
- Strip non-breaking spaces and regular spaces: `amount.replaceAll("[\\s\u00A0]", "")`
- Handle comma as decimal separator: `.replace(",", ".")`
- **Subunit conversion — avoid floating point:** split on `.`, take integer + fractional parts separately, combine as `intPart * 100 + fracPart`. Pad fractional to 2 digits.
- Type determined by sign: negative = EXPENSE, positive = INCOME
- Skip zero-amount rows (informational entries)

### Duplicate Detection
- `sourceRef` = hash of `date + amount + description` (consistent per row)
- On confirm: check for existing transactions with matching `accountId + date + amount + description`
- Return `{ imported: N, skipped: M }` — skipped rows are not errors, just warnings

### Import Confirm Logic
- `ImportService.confirmImport()` annotated `@Transactional` — all-or-nothing
- Iterates over `ConfirmRow` items, calls internal transaction creation logic per row
- Skip `enrichWithNames()` per row (not needed — return count only, not full responses)
- Category-type validation preserved: INCOME transaction requires INCOME category

### Category Hints
Map MCC codes (Monobank) and description patterns to existing category names:
- 5411 → "Products and supermarkets"
- 5812/5814 → "Cafes and restaurants"
- 4111/4121 → "Travel"/"Taxi"
- etc.
These are suggestions only — the user picks the actual category in the UI.

### Tests
- `ImportServiceTest.java` — unit tests with mocked parsers
- `ImportServiceIT.java` — integration tests with Testcontainers (full flow: parse + save + balance check)
- Each parser: test with real PDF samples from `external-resources/`

## Frontend

### New Files
- `src/api/use-import.ts` — upload (useMutation with FormData) + confirm mutations
- `src/pages/import.tsx` — upload form + editable preview table
- `src/types/import.ts` — ImportRow, ConfirmRow, ImportRowState (with UI-only fields)

### API Client Update
- `client.ts` needs a `postForm` method (or conditional Content-Type logic):
  - Do NOT set `Content-Type: application/json` for `FormData` bodies
  - Browser sets `Content-Type: multipart/form-data` with boundary automatically

### Router
- Add route: `/import` → `ImportPage`
- Add sidebar nav item: "Import" with `Upload` icon from lucide-react

### Import Page Flow
1. **Upload form:** File input (PDF) + Account select dropdown
   - Error display zone below form for failed parse attempts (`previewMutation.error?.message`)
2. **Preview table** (after upload succeeds):
   - Use plain Shadcn `<Table>` with `useState<ImportRowState[]>` — NOT TanStack Table
   - Columns: Checkbox, Date, Type (toggle INCOME/EXPENSE), Amount (editable), Description (editable), Category (select dropdown), Actions (remove row)
   - Type column: Button/badge that toggles between INCOME and EXPENSE on click — **must reset categoryId to undefined**
   - Category column: Select with all categories filtered by current type
   - Checkbox column: header checkbox (all/none/indeterminate) + per-row checkbox
   - "Remove selected (N)" button appears when any rows are checked
   - "Import N transactions" button at the bottom (live count of remaining rows)
3. **After import:** Toast success with count (including skipped), redirect to transactions page

### State Management
- Preview rows: `useState<ImportRowState[]>` — local mutable copy of parsed rows
- Selected rows: `useState<Set<number>>` — indexes for bulk removal
- `ImportRowState` extends `ImportRow` with UI-only fields: `categoryId?: string`, `categoryAutoSelected: boolean`
- Amounts stay as **subunits** in local state at all times — format only for display
- `updateRow(index, patch)` and `removeRow(index)` helper functions

### Category Auto-Selection
- On preview load: one-time resolution pass matching `categoryHint` → existing categories by exact name + type match
- Auto-selected categories marked with `categoryAutoSelected: true` (visual indicator in UI)
- Manual category change clears the flag
- Pure client-side array lookup using `useCategories()` data — no extra API calls

### Cache Invalidation
- `useImportPreview` — no cache invalidation (stateless server call)
- `useImportConfirm` — invalidate `transactions.all`, `accounts.all`, `dashboard`

### Key UI Details
- Show bank name and detected currency after upload
- Show total row count and sum of amounts
- Allow removing individual rows or bulk-removing via checkboxes
- Amount displayed in human-readable format (divided by 100), but stored/sent as subunits
- Category dropdown filters by INCOME/EXPENSE type of each row
- No virtual scrolling — YAGNI for personal finance app (max ~200 rows per statement)
