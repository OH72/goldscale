package com.goldscale.service;

import com.goldscale.config.TestcontainersConfig;
import com.goldscale.dto.request.CreateAccountRequest;
import com.goldscale.dto.request.CreateCategoryRequest;
import com.goldscale.dto.request.TransactionCommand.CreateExpense;
import com.goldscale.dto.request.TransactionCommand.CreateIncome;
import com.goldscale.dto.request.TransactionCommand.CreateTransfer;
import com.goldscale.dto.request.UpdateTransactionRequest;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.model.CategoryType;
import com.goldscale.model.Currency;
import com.goldscale.model.TransactionType;
import com.goldscale.model.Account;
import com.goldscale.repository.AccountRepository;
import com.goldscale.repository.CategoryRepository;
import com.goldscale.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfig.class)
class TransactionServiceIT {

    @Autowired private TransactionService transactionService;
    @Autowired private AccountService accountService;
    @Autowired private CategoryService categoryService;
    @Autowired private BalanceService balanceService;
    @Autowired private AccountRepository accountRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private TransactionRepository transactionRepository;
    @Autowired private MongoTemplate mongoTemplate;

    private String accountId;
    private String targetAccountId;
    private String incomeCategoryId;
    private String expenseCategoryId;

    @BeforeEach
    void setUp() {
        transactionRepository.deleteAll();
        accountRepository.deleteAll();
        categoryRepository.deleteAll();

        var account = accountService.create(new CreateAccountRequest("Main", Currency.UAH, 1000000L));
        accountId = account.getId();
        var target = accountService.create(new CreateAccountRequest("USD Account", Currency.USD, 50000L));
        targetAccountId = target.getId();
        incomeCategoryId = categoryService.create(
                new CreateCategoryRequest("Salary", CategoryType.INCOME, null)).getId();
        expenseCategoryId = categoryService.create(
                new CreateCategoryRequest("Food", CategoryType.EXPENSE, null)).getId();
    }

    @Test
    void should_increaseBalance_when_incomeCreated() {
        transactionService.create(new CreateIncome(
                accountId, 5000000L, incomeCategoryId, LocalDate.of(2026, 10, 1), "salary"));

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(6000000L); // 1000000 + 5000000
    }

    @Test
    void should_decreaseBalance_when_expenseCreated() {
        transactionService.create(new CreateExpense(
                accountId, 150000L, expenseCategoryId, LocalDate.of(2026, 10, 2), "groceries"));

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(850000L); // 1000000 - 150000
    }

    @Test
    void should_adjustBalanceByDelta_when_expenseEdited() {
        var txn = transactionService.create(new CreateExpense(
                accountId, 150000L, expenseCategoryId, LocalDate.of(2026, 10, 2), "groceries"));
        // balance = 850000

        transactionService.update(txn.id(), new UpdateTransactionRequest(
                200000L, expenseCategoryId, LocalDate.of(2026, 10, 2), "groceries updated", null));

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(800000L); // 850000 - 50000 delta
    }

    @Test
    void should_reverseBalance_when_expenseDeleted() {
        var txn = transactionService.create(new CreateExpense(
                accountId, 150000L, expenseCategoryId, LocalDate.of(2026, 10, 2), "groceries"));
        // balance = 850000

        transactionService.delete(txn.id());

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(1000000L); // restored to initial
    }

    @Test
    void should_reverseBalance_when_incomeDeleted() {
        var txn = transactionService.create(new CreateIncome(
                accountId, 300000L, incomeCategoryId, LocalDate.now(), null));
        // balance = 1300000

        transactionService.delete(txn.id());

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(1000000L);
    }

    @Test
    void should_preventDeletion_when_initialBalance() {
        var txns = transactionRepository.findByAccountIdAndDeletedFalse(accountId);
        var initTxn = txns.stream()
                .filter(t -> t.getType() == TransactionType.INITIAL_BALANCE)
                .findFirst().orElseThrow();

        assertThatThrownBy(() -> transactionService.delete(initTxn.getId()))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("INITIAL_BALANCE");
    }

    @Test
    void should_allowEditingInitialBalanceAmount() {
        var txns = transactionRepository.findByAccountIdAndDeletedFalse(accountId);
        var initTxn = txns.stream()
                .filter(t -> t.getType() == TransactionType.INITIAL_BALANCE)
                .findFirst().orElseThrow();

        transactionService.update(initTxn.getId(), new UpdateTransactionRequest(
                2000000L, null, LocalDate.now(), null, null));

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(2000000L); // 1000000 + (2000000 - 1000000)
    }

    @Test
    void should_excludeSoftDeleted_when_listing() {
        transactionService.create(new CreateIncome(
                accountId, 100000L, incomeCategoryId, LocalDate.now(), "visible"));
        var toDelete = transactionService.create(new CreateExpense(
                accountId, 50000L, expenseCategoryId, LocalDate.now(), "will be deleted"));
        transactionService.delete(toDelete.id());

        var page = transactionService.findAll(accountId, null, null, null, null, null, null, PageRequest.of(0, 50));

        assertThat(page.getContent()).noneMatch(t -> t.description() != null && t.description().equals("will be deleted"));
        // INITIAL_BALANCE + income = 2 active
        assertThat(page.getTotalElements()).isEqualTo(2);
    }

    @Test
    void should_filterByType_when_typeProvided() {
        transactionService.create(new CreateIncome(
                accountId, 100000L, incomeCategoryId, LocalDate.now(), null));
        transactionService.create(new CreateExpense(
                accountId, 50000L, expenseCategoryId, LocalDate.now(), null));

        var incomePage = transactionService.findAll(
                null, TransactionType.INCOME, null, null, null, null, null, PageRequest.of(0, 50));
        assertThat(incomePage.getContent()).allMatch(t -> t.type() == TransactionType.INCOME);

        var expensePage = transactionService.findAll(
                null, TransactionType.EXPENSE, null, null, null, null, null, PageRequest.of(0, 50));
        assertThat(expensePage.getContent()).allMatch(t -> t.type() == TransactionType.EXPENSE);
    }

    @Test
    void should_filterByDateRange_when_datesProvided() {
        transactionService.create(new CreateIncome(
                accountId, 100000L, incomeCategoryId, LocalDate.of(2026, 9, 15), "sept"));
        transactionService.create(new CreateIncome(
                accountId, 200000L, incomeCategoryId, LocalDate.of(2026, 10, 5), "oct"));

        var page = transactionService.findAll(
                null, null, null, null,
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31),
                null, PageRequest.of(0, 50));

        assertThat(page.getContent()).allMatch(t -> !t.date().isBefore(LocalDate.of(2026, 10, 1)));
    }

    @Test
    void should_filterByEndDateOnly_when_noStartDate() {
        transactionService.create(new CreateIncome(
                accountId, 100000L, incomeCategoryId, LocalDate.of(2026, 9, 15), "sept"));
        transactionService.create(new CreateIncome(
                accountId, 200000L, incomeCategoryId, LocalDate.of(2026, 11, 5), "nov"));

        var page = transactionService.findAll(
                null, null, null, null,
                null, LocalDate.of(2026, 10, 1),
                null, PageRequest.of(0, 50));

        assertThat(page.getContent()).allMatch(t -> !t.date().isAfter(LocalDate.of(2026, 10, 1)));
    }

    @Test
    void should_useBothCategoryForIncomeAndExpense() {
        var categoryId = categoryService.create(
                new CreateCategoryRequest("Other", CategoryType.BOTH, null)).getId();

        transactionService.create(new CreateIncome(
                accountId, 100000L, categoryId, LocalDate.now(), "income"));
        transactionService.create(new CreateExpense(
                accountId, 50000L, categoryId, LocalDate.now(), "expense"));

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(1050000L); // 1000000 + 100000 - 50000
    }

    @Test
    void should_rejectExpenseCategoryOnIncome() {
        assertThatThrownBy(() -> transactionService.create(
                new CreateIncome(accountId, 1000L, expenseCategoryId, LocalDate.now(), null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("EXPENSE");
    }

    @Test
    void should_enrichResponseWithNames_when_returning() {
        var txn = transactionService.create(new CreateIncome(
                accountId, 100000L, incomeCategoryId, LocalDate.now(), "test"));

        assertThat(txn.accountName()).isEqualTo("Main");
        assertThat(txn.categoryName()).isEqualTo("Salary");
    }

    @Test
    void should_adjustBothBalances_when_transferCreated() {
        transactionService.create(new CreateTransfer(
                accountId, targetAccountId, 200000L, 540L,
                LocalDate.of(2026, 10, 3), "UAH to USD"));

        var source = accountRepository.findById(accountId).orElseThrow();
        var target = accountRepository.findById(targetAccountId).orElseThrow();
        assertThat(source.getBalance()).isEqualTo(800000L);  // 1000000 - 200000
        assertThat(target.getBalance()).isEqualTo(50540L);    // 50000 + 540
    }

    @Test
    void should_adjustBothByDelta_when_transferEdited() {
        var txn = transactionService.create(new CreateTransfer(
                accountId, targetAccountId, 200000L, 540L,
                LocalDate.of(2026, 10, 3), "transfer"));
        // source=800000, target=50540

        transactionService.update(txn.id(), new UpdateTransactionRequest(
                300000L, null, LocalDate.of(2026, 10, 3), "updated", 800L));
        // source delta: -(300000 - 200000) = -100000 -> 700000
        // target delta: 800 - 540 = 260 -> 50800

        var source = accountRepository.findById(accountId).orElseThrow();
        var target = accountRepository.findById(targetAccountId).orElseThrow();
        assertThat(source.getBalance()).isEqualTo(700000L);
        assertThat(target.getBalance()).isEqualTo(50800L);
    }

    @Test
    void should_reverseBothBalances_when_transferDeleted() {
        var txn = transactionService.create(new CreateTransfer(
                accountId, targetAccountId, 200000L, 540L,
                LocalDate.of(2026, 10, 3), "transfer"));
        // source=800000, target=50540

        transactionService.delete(txn.id());

        var source = accountRepository.findById(accountId).orElseThrow();
        var target = accountRepository.findById(targetAccountId).orElseThrow();
        assertThat(source.getBalance()).isEqualTo(1000000L);
        assertThat(target.getBalance()).isEqualTo(50000L);
    }

    @Test
    void should_enrichTargetAccountName_when_transferReturned() {
        var txn = transactionService.create(new CreateTransfer(
                accountId, targetAccountId, 100000L, 270L,
                LocalDate.of(2026, 10, 3), null));

        assertThat(txn.accountName()).isEqualTo("Main");
        assertThat(txn.targetAccountName()).isEqualTo("USD Account");
        assertThat(txn.exchangeRate()).isCloseTo(0.0027, org.assertj.core.data.Offset.offset(0.0001));
    }

    @Test
    void should_showTransferForBothAccounts_when_filtering() {
        transactionService.create(new CreateTransfer(
                accountId, targetAccountId, 100000L, 270L,
                LocalDate.of(2026, 10, 3), "cross"));

        var sourcePage = transactionService.findAll(
                accountId, TransactionType.TRANSFER, null, null, null, null, null, PageRequest.of(0, 50));
        assertThat(sourcePage.getContent()).hasSize(1);

        var targetPage = transactionService.findAll(
                targetAccountId, TransactionType.TRANSFER, null, null, null, null, null, PageRequest.of(0, 50));
        assertThat(targetPage.getContent()).hasSize(1);
    }

    @Test
    void should_rejectTransfer_when_sameAccount() {
        assertThatThrownBy(() -> transactionService.create(
                new CreateTransfer(accountId, accountId, 1000L, 1000L, LocalDate.now(), null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("different");
    }

    @Test
    void should_recalculateAndFix_when_auditRun() {
        transactionService.create(new CreateIncome(
                accountId, 500000L, incomeCategoryId, LocalDate.now(), null));
        transactionService.create(new CreateExpense(
                accountId, 200000L, expenseCategoryId, LocalDate.now(), null));
        // balance = 1000000 + 500000 - 200000 = 1300000

        var result = balanceService.audit(accountId);
        assertThat(result.match()).isTrue();
        assertThat(result.calculatedBalance()).isEqualTo(1300000L);
    }

    @Test
    void should_includeTransfersInAudit_when_accountIsTargetOrSource() {
        transactionService.create(new CreateTransfer(
                accountId, targetAccountId, 200000L, 540L,
                LocalDate.of(2026, 10, 3), null));
        // source: 1000000 - 200000 = 800000
        // target: 50000 + 540 = 50540

        var sourceAudit = balanceService.audit(accountId);
        assertThat(sourceAudit.match()).isTrue();
        assertThat(sourceAudit.calculatedBalance()).isEqualTo(800000L);

        var targetAudit = balanceService.audit(targetAccountId);
        assertThat(targetAudit.match()).isTrue();
        assertThat(targetAudit.calculatedBalance()).isEqualTo(50540L);
    }

    @Test
    void should_detectAndFixMismatch_when_balanceCorrupted() {
        transactionService.create(new CreateIncome(
                accountId, 500000L, incomeCategoryId, LocalDate.now(), null));
        // correct balance = 1500000

        // corrupt the balance directly
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(accountId)),
                new Update().set("balance", 9999999L),
                Account.class);

        var result = balanceService.audit(accountId);
        assertThat(result.match()).isFalse();
        assertThat(result.storedBalance()).isEqualTo(9999999L);
        assertThat(result.calculatedBalance()).isEqualTo(1500000L);

        // verify balance was fixed
        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(1500000L);
    }

    @Test
    void should_handleSameCurrencyTransfer_when_amountEqualsTargetAmount() {
        // Create a second UAH account
        var uah2 = accountService.create(new CreateAccountRequest("UAH Savings", Currency.UAH, 500000L));
        var uah2Id = uah2.getId();

        var txn = transactionService.create(new CreateTransfer(
                accountId, uah2Id, 200000L, 200000L,
                LocalDate.of(2026, 10, 3), "same currency"));

        assertThat(txn.exchangeRate()).isEqualTo(1.0);

        var source = accountRepository.findById(accountId).orElseThrow();
        var target = accountRepository.findById(uah2Id).orElseThrow();
        assertThat(source.getBalance()).isEqualTo(800000L);
        assertThat(target.getBalance()).isEqualTo(700000L);
    }

    @Test
    void should_handleMultipleOperationsCorrectly_when_balanceAudited() {
        // Create: +500000 income, -200000 expense, -100000 expense
        transactionService.create(new CreateIncome(
                accountId, 500000L, incomeCategoryId, LocalDate.now(), null));
        var exp1 = transactionService.create(new CreateExpense(
                accountId, 200000L, expenseCategoryId, LocalDate.now(), null));
        transactionService.create(new CreateExpense(
                accountId, 100000L, expenseCategoryId, LocalDate.now(), null));
        // Expected: 1000000 + 500000 - 200000 - 100000 = 1200000

        // Edit exp1: 200000 -> 300000
        transactionService.update(exp1.id(), new UpdateTransactionRequest(
                300000L, expenseCategoryId, LocalDate.now(), null, null));
        // Expected: 1200000 - 100000 = 1100000

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(1100000L);
    }
}
