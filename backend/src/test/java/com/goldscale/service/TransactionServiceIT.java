package com.goldscale.service;

import com.goldscale.config.TestcontainersConfig;
import com.goldscale.dto.request.CreateAccountRequest;
import com.goldscale.dto.request.CreateCategoryRequest;
import com.goldscale.dto.request.TransactionCommand.CreateExpense;
import com.goldscale.dto.request.TransactionCommand.CreateIncome;
import com.goldscale.dto.request.UpdateTransactionRequest;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.model.CategoryType;
import com.goldscale.model.Currency;
import com.goldscale.model.TransactionType;
import com.goldscale.repository.AccountRepository;
import com.goldscale.repository.CategoryRepository;
import com.goldscale.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfig.class)
class TransactionServiceIT {

    @Autowired private TransactionService transactionService;
    @Autowired private AccountService accountService;
    @Autowired private CategoryService categoryService;
    @Autowired private AccountRepository accountRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private TransactionRepository transactionRepository;

    private String accountId;
    private String incomeCategoryId;
    private String expenseCategoryId;

    @BeforeEach
    void setUp() {
        transactionRepository.deleteAll();
        accountRepository.deleteAll();
        categoryRepository.deleteAll();

        var account = accountService.create(new CreateAccountRequest("Main", Currency.UAH, 1000000L));
        accountId = account.getId();
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

        var page = transactionService.findAll(accountId, null, null, null, null, PageRequest.of(0, 50));

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
                null, TransactionType.INCOME, null, null, null, PageRequest.of(0, 50));
        assertThat(incomePage.getContent()).allMatch(t -> t.type() == TransactionType.INCOME);

        var expensePage = transactionService.findAll(
                null, TransactionType.EXPENSE, null, null, null, PageRequest.of(0, 50));
        assertThat(expensePage.getContent()).allMatch(t -> t.type() == TransactionType.EXPENSE);
    }

    @Test
    void should_filterByDateRange_when_datesProvided() {
        transactionService.create(new CreateIncome(
                accountId, 100000L, incomeCategoryId, LocalDate.of(2026, 9, 15), "sept"));
        transactionService.create(new CreateIncome(
                accountId, 200000L, incomeCategoryId, LocalDate.of(2026, 10, 5), "oct"));

        var page = transactionService.findAll(
                null, null, null,
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31),
                PageRequest.of(0, 50));

        assertThat(page.getContent()).allMatch(t -> !t.date().isBefore(LocalDate.of(2026, 10, 1)));
    }

    @Test
    void should_filterByEndDateOnly_when_noStartDate() {
        transactionService.create(new CreateIncome(
                accountId, 100000L, incomeCategoryId, LocalDate.of(2026, 9, 15), "sept"));
        transactionService.create(new CreateIncome(
                accountId, 200000L, incomeCategoryId, LocalDate.of(2026, 11, 5), "nov"));

        var page = transactionService.findAll(
                null, null, null,
                null, LocalDate.of(2026, 10, 1),
                PageRequest.of(0, 50));

        assertThat(page.getContent()).allMatch(t -> !t.date().isAfter(LocalDate.of(2026, 10, 1)));
    }

    @Test
    void should_rejectCategoryMismatch_when_expenseCategoryOnIncome() {
        assertThatThrownBy(() -> transactionService.create(
                new CreateIncome(accountId, 1000L, expenseCategoryId, LocalDate.now(), null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("EXPENSE but expected INCOME");
    }

    @Test
    void should_enrichResponseWithNames_when_returning() {
        var txn = transactionService.create(new CreateIncome(
                accountId, 100000L, incomeCategoryId, LocalDate.now(), "test"));

        assertThat(txn.accountName()).isEqualTo("Main");
        assertThat(txn.categoryName()).isEqualTo("Salary");
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
