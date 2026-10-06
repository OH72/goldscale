package com.goldscale.service;

import com.goldscale.config.TestcontainersConfig;
import com.goldscale.dto.request.CreateAccountRequest;
import com.goldscale.dto.request.CreateCategoryRequest;
import com.goldscale.dto.request.TransactionCommand.CreateExpense;
import com.goldscale.dto.request.TransactionCommand.CreateIncome;
import com.goldscale.dto.request.TransactionCommand.CreateTransfer;
import com.goldscale.model.CategoryType;
import com.goldscale.model.Currency;
import com.goldscale.model.ExchangeRate;
import com.goldscale.model.TransactionType;
import com.goldscale.repository.AccountRepository;
import com.goldscale.repository.CategoryRepository;
import com.goldscale.repository.ExchangeRateRepository;
import com.goldscale.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfig.class)
class DashboardServiceIT {

    @Autowired private DashboardService dashboardService;
    @Autowired private TransactionService transactionService;
    @Autowired private AccountService accountService;
    @Autowired private CategoryService categoryService;
    @Autowired private AccountRepository accountRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private TransactionRepository transactionRepository;
    @Autowired private ExchangeRateRepository exchangeRateRepository;

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
    void should_returnAllAccountsAndRecentTransactions() {
        transactionService.create(new CreateIncome(
                accountId, 100000L, incomeCategoryId, LocalDate.of(2026, 10, 1), "income1"));
        transactionService.create(new CreateExpense(
                accountId, 50000L, expenseCategoryId, LocalDate.of(2026, 10, 2), "expense1"));
        transactionService.create(new CreateTransfer(
                accountId, targetAccountId, 30000L, 80L,
                LocalDate.of(2026, 10, 3), "transfer1"));

        var dashboard = dashboardService.getDashboard();

        // recentTransactions excludes INITIAL_BALANCE
        assertThat(dashboard.recentTransactions()).hasSize(3);
        assertThat(dashboard.recentTransactions())
                .noneMatch(t -> t.type() == TransactionType.INITIAL_BALANCE);
    }

    @Test
    void should_limitTo10RecentTransactions() {
        for (int i = 0; i < 12; i++) {
            transactionService.create(new CreateIncome(
                    accountId, 10000L, incomeCategoryId,
                    LocalDate.of(2026, 10, 1).plusDays(i), "tx" + i));
        }

        var dashboard = dashboardService.getDashboard();

        assertThat(dashboard.recentTransactions()).hasSize(10);
    }

    @Test
    void should_enrichNamesInRecentTransactions() {
        transactionService.create(new CreateTransfer(
                accountId, targetAccountId, 100000L, 270L,
                LocalDate.of(2026, 10, 3), null));

        var dashboard = dashboardService.getDashboard();

        var transfer = dashboard.recentTransactions().stream()
                .filter(t -> t.type() == TransactionType.TRANSFER)
                .findFirst().orElseThrow();
        assertThat(transfer.accountName()).isEqualTo("Main");
        assertThat(transfer.targetAccountName()).isEqualTo("USD Account");
    }

    @Test
    void should_excludeSoftDeletedFromDashboard() {
        var txn = transactionService.create(new CreateIncome(
                accountId, 100000L, incomeCategoryId, LocalDate.now(), "will delete"));
        transactionService.delete(txn.id());

        var dashboard = dashboardService.getDashboard();

        assertThat(dashboard.recentTransactions())
                .noneMatch(t -> "will delete".equals(t.description()));
    }

    private void seedRates() {
        exchangeRateRepository.deleteAll();
        var today = LocalDate.now();
        for (int i = 0; i <= 7; i++) {
            var rate = new ExchangeRate();
            rate.setId(today.minusDays(i).toString());
            // USD-based, scaled by 1_000_000; GBP deliberately absent
            rate.setRates(Map.of("USD", 1_000_000L, "UAH", 25_000L, "EUR", 1_100_000L));
            exchangeRateRepository.save(rate);
        }
    }

    @Test
    void should_convertMixedCurrencyNetWorth_when_ratesSeeded() {
        seedRates();
        // setUp accounts: Main UAH 1_000_000 + USD Account 50_000 USD-subunits
        accountService.create(new CreateAccountRequest("No Rate", Currency.GBP, 5_000L));

        var dashboard = dashboardService.getDashboard();

        // 1_000_000 + 50_000 * 1_000_000 / 25_000 = 3_000_000; GBP has no rate and contributes 0
        assertThat(dashboard.totalNetWorth()).isEqualTo(3_000_000L);
        assertThat(dashboard.displayCurrency()).isEqualTo(Currency.UAH);
    }
}
