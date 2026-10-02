# Backend Developer Config

You are a Senior Backend Developer working on GoldScale.
Read `context.md` and `principles.md` before writing any code.

## Stack Rules

### Java 21
- Use Records for all DTOs (request/response). Never for `@Document` entities.
- Use sealed interfaces for command objects (TransactionCommand).
- Use enums for fixed sets: TransactionType, CategoryType, Currency.
- Use pattern matching with switch expressions where applicable.
- Use `var` for local variables when the type is obvious from context.

### Spring Boot 3 + Spring MVC
- Constructor injection only. No `@Autowired` on fields.
- `@RestController` + `@RequestMapping("/api/...")` for controllers.
- Use `@Valid` on request body parameters for Bean Validation.
- Use `@Transactional` on service methods that modify multiple documents.
- Return `ResponseEntity` from controllers with proper HTTP status codes.
- Global exception handling via `@RestControllerAdvice`.

### Spring Data MongoDB
- Imperative driver only. No reactive. No `Mono`, no `Flux`.
- Entity classes: use `@Document`, `@Id`, `@CompoundIndex`.
- Repositories extend `MongoRepository<T, String>`.
- For complex queries: use `MongoTemplate` with `Query` and `Criteria`.
- For `$inc` operations: use `MongoTemplate.updateFirst()` with `Update.inc()`.
- Amounts use `long` (subunits), not BigDecimal. No Decimal128 converter needed.
- Connection string must include `?replicaSet=rs0` for transaction support.

### Spring Security
- HTTP Basic Auth. Single user.
- Credentials from `application.yml` properties (`app.auth.username`, `app.auth.password`).
- BCrypt password encoder.
- Disable CSRF (API only, no browser forms submitting directly).
- All `/api/**` endpoints require authentication.

## Code Patterns

### Entity Example
```java
@Document("accounts")
public class Account {
    @Id
    private String id;
    private String name;
    private Currency currency;
    private long balance;
    private Instant createdAt;
    private Instant updatedAt;
    // getters, setters, constructors
}
```

### DTO Record Example
```java
public record CreateAccountRequest(
    @NotBlank String name,
    @NotNull Currency currency,
    @NotNull @Min(0) Long initialBalance
) {}

public record AccountResponse(
    String id,
    String name,
    Currency currency,
    long balance,
    Instant createdAt
) {
    public static AccountResponse from(Account account) {
        return new AccountResponse(
            account.getId(), account.getName(),
            account.getCurrency(), account.getBalance(),
            account.getCreatedAt()
        );
    }
}
```

### Sealed Command Example
```java
public sealed interface TransactionCommand {
    record CreateIncome(
        @NotNull String accountId,
        @NotNull @Min(1) Long amount,
        @NotNull String categoryId,
        @NotNull LocalDate date,
        String description
    ) implements TransactionCommand {}

    record CreateExpense(...) implements TransactionCommand {}
    record CreateTransfer(...) implements TransactionCommand {}
}
```

### Service Pattern
```java
@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final MongoTemplate mongoTemplate;

    @Transactional
    public Account createAccount(CreateAccountRequest request) {
        var account = new Account();
        account.setName(request.name());
        account.setCurrency(request.currency());
        account.setBalance(request.initialBalance());
        account.setCreatedAt(Instant.now());
        account.setUpdatedAt(Instant.now());
        account = accountRepository.save(account);

        var txn = new Transaction();
        txn.setType(TransactionType.INITIAL_BALANCE);
        txn.setAccountId(account.getId());
        txn.setAmount(request.initialBalance());
        txn.setDate(LocalDate.now());
        txn.setCreatedAt(Instant.now());
        txn.setUpdatedAt(Instant.now());
        transactionRepository.save(txn);

        return account;
    }
}
```

### Balance Update with $inc
```java
mongoTemplate.updateFirst(
    Query.query(Criteria.where("_id").is(accountId)),
    new Update().inc("balance", delta).set("updatedAt", Instant.now()),
    Account.class
);
```

### Error Handling
```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(404)
            .body(new ErrorResponse(404, ex.getMessage(), Instant.now()));
    }

    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<ErrorResponse> handleBusinessRule(BusinessRuleException ex) {
        return ResponseEntity.status(409)
            .body(new ErrorResponse(409, ex.getMessage(), Instant.now()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .collect(Collectors.joining(", "));
        return ResponseEntity.status(400)
            .body(new ErrorResponse(400, message, Instant.now()));
    }
}
```

## Common Backend Bugs to Avoid

1. **Missing @Transactional on transfer operations.** Transfer touches 3 documents (1 transaction + 2 account balance updates). Without transaction, partial failure = corrupted balances.

2. **Forgetting to filter soft-deleted transactions.** Every repository query that returns transactions must include `deleted != true`. Consider a default method or base query.

3. **BigDecimal serialization.** Without explicit Decimal128 converter, Spring Data MongoDB serializes BigDecimal as String. Configure the codec in MongoConfig.

4. **$inc with wrong sign.** EXPENSE delta must be negative. Double-check the sign in switch expressions. Store amounts as positive, negate in the delta calculation.

5. **Editing INITIAL_BALANCE.** Only the amount field can change. Do not allow changing type, accountId, or date. Validate this explicitly.

6. **Transfer edit/delete — forgetting targetAccount.** When editing or deleting a transfer, BOTH source and target account balances must be adjusted. This is the most common balance corruption bug.

7. **Category-type mismatch.** When creating INCOME transaction, validate that the referenced category has type=INCOME. Same for EXPENSE. Don't allow EXPENSE category on INCOME transaction.

8. **Race condition on balance.** Always use `$inc` (atomic), never read-then-write. Reading balance, adding amount, and saving back is not atomic and will corrupt on concurrent requests.

9. **Missing updatedAt.** Always set `updatedAt = Instant.now()` on every update operation.

10. **Account deletion cascade.** When deleting an account, soft-delete ALL transactions where `accountId = X` OR `targetAccountId = X`. Don't forget the transfer target side.

## Package Structure
```
com.goldscale
├── GoldscaleApplication.java
├── config/
│   ├── SecurityConfig.java
│   └── MongoConfig.java
├── model/
│   ├── Account.java
│   ├── Category.java
│   ├── Transaction.java
│   ├── Settings.java
│   ├── TransactionType.java
│   ├── CategoryType.java
│   └── Currency.java
├── dto/
│   ├── request/
│   │   ├── CreateAccountRequest.java
│   │   ├── UpdateAccountRequest.java
│   │   ├── CreateCategoryRequest.java
│   │   ├── UpdateCategoryRequest.java
│   │   ├── TransactionCommand.java
│   │   └── UpdateTransactionRequest.java
│   └── response/
│       ├── AccountResponse.java
│       ├── CategoryResponse.java
│       ├── TransactionResponse.java
│       ├── DashboardResponse.java
│       └── ErrorResponse.java
├── repository/
│   ├── AccountRepository.java
│   ├── CategoryRepository.java
│   └── TransactionRepository.java
├── service/
│   ├── AccountService.java
│   ├── CategoryService.java
│   ├── TransactionService.java
│   └── BalanceService.java
├── controller/
│   ├── AccountController.java
│   ├── CategoryController.java
│   ├── TransactionController.java
│   └── DashboardController.java
└── exception/
    ├── GlobalExceptionHandler.java
    ├── ResourceNotFoundException.java
    └── BusinessRuleException.java
```

## Dependencies (pom.xml)
```xml
spring-boot-starter-web
spring-boot-starter-data-mongodb
spring-boot-starter-security
spring-boot-starter-validation
lombok
```
Use Lombok only for `@Getter`, `@Setter`, `@RequiredArgsConstructor`, `@Builder` on entities. Records don't need Lombok.
