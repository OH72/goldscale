package com.goldscale.service;

import com.goldscale.config.TestcontainersConfig;
import com.goldscale.dto.request.CreateAccountRequest;
import com.goldscale.model.Currency;
import com.goldscale.model.ExchangeRate;
import com.goldscale.model.Transaction;
import com.goldscale.model.TransactionType;
import com.goldscale.dto.request.UpdateAccountRequest;
import com.goldscale.dto.request.UpdateSettingsRequest;
import com.goldscale.dto.response.AccountResponse;
import com.goldscale.repository.AccountRepository;
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
class AccountServiceIT {

    @Autowired private AccountService accountService;
    @Autowired private AccountRepository accountRepository;
    @Autowired private TransactionRepository transactionRepository;
    @Autowired private ExchangeRateRepository exchangeRateRepository;
    @Autowired private DashboardService dashboardService;
    @Autowired private SettingsService settingsService;

    @BeforeEach
    void cleanUp() {
        transactionRepository.deleteAll();
        accountRepository.deleteAll();
        exchangeRateRepository.deleteAll();
        settingsService.update(new UpdateSettingsRequest(Currency.UAH, null));
    }

    @Test
    void should_persistAccountWithBalance_when_created() {
        var request = new CreateAccountRequest("Mono UAH", Currency.UAH, 500000L);

        var result = accountService.create(request);

        var saved = accountRepository.findById(result.getId()).orElseThrow();
        assertThat(saved.getName()).isEqualTo("Mono UAH");
        assertThat(saved.getCurrency()).isEqualTo(Currency.UAH);
        assertThat(saved.getBalance()).isEqualTo(500000L);
    }

    @Test
    void should_createInitialBalanceTransaction_when_accountCreated() {
        var account = accountService.create(new CreateAccountRequest("Test", Currency.USD, 100000L));

        var transactions = transactionRepository.findByAccountIdAndDeletedFalse(account.getId());
        assertThat(transactions).hasSize(1);

        var txn = transactions.getFirst();
        assertThat(txn.getType()).isEqualTo(TransactionType.INITIAL_BALANCE);
        assertThat(txn.getAmount()).isEqualTo(100000L);
        assertThat(txn.isDeleted()).isFalse();
    }

    @Test
    void should_handleZeroInitialBalance_when_created() {
        var account = accountService.create(new CreateAccountRequest("Empty", Currency.EUR, 0L));

        assertThat(account.getBalance()).isEqualTo(0L);
        var txns = transactionRepository.findByAccountIdAndDeletedFalse(account.getId());
        assertThat(txns).hasSize(1);
        assertThat(txns.getFirst().getAmount()).isEqualTo(0L);
    }

    @Test
    void should_softDeleteTransactions_when_accountDeleted() {
        var account = accountService.create(new CreateAccountRequest("ToDelete", Currency.UAH, 100L));

        accountService.delete(account.getId());

        assertThat(accountRepository.findById(account.getId())).isEmpty();
        var txns = transactionRepository.findAll();
        assertThat(txns).hasSize(1);
        assertThat(txns.getFirst().isDeleted()).isTrue();
    }

    @Test
    void should_softDeleteTransferTransactions_when_targetAccountDeleted() {
        var source = accountService.create(new CreateAccountRequest("Source", Currency.UAH, 100000L));
        var target = accountService.create(new CreateAccountRequest("Target", Currency.UAH, 0L));

        // Manually create a transfer transaction referencing target
        var transfer = new Transaction();
        transfer.setType(TransactionType.TRANSFER);
        transfer.setAccountId(source.getId());
        transfer.setTargetAccountId(target.getId());
        transfer.setAmount(50000L);
        transfer.setTargetAmount(50000L);
        transfer.setDeleted(false);
        transactionRepository.save(transfer);

        accountService.delete(target.getId());

        var remaining = transactionRepository.findAll().stream()
                .filter(t -> t.getType() == TransactionType.TRANSFER)
                .toList();
        assertThat(remaining).hasSize(1);
        assertThat(remaining.getFirst().isDeleted()).isTrue();
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
    void should_returnConvertedBalances_when_ratesSeeded() {
        seedRates();
        accountService.create(new CreateAccountRequest("UAH", Currency.UAH, 100_000L));
        accountService.create(new CreateAccountRequest("USD", Currency.USD, 1_000L));
        accountService.create(new CreateAccountRequest("EUR", Currency.EUR, 1_000L));

        var result = accountService.findAllWithConvertedBalance().stream()
                .collect(java.util.stream.Collectors.toMap(AccountResponse::name, AccountResponse::balanceInDisplayCurrency));

        assertThat(result).containsEntry("UAH", 100_000L)
                .containsEntry("USD", 40_000L)    // 1000 * 1_000_000 / 25_000
                .containsEntry("EUR", 44_000L);   // 1000 * 1_100_000 / 25_000
    }

    @Test
    void should_returnNullConvertedBalance_when_noRateForCurrency() {
        seedRates();
        accountService.create(new CreateAccountRequest("GBP", Currency.GBP, 1_000L));

        var result = accountService.findAllWithConvertedBalance();

        assertThat(result).singleElement().satisfies(r -> {
            assertThat(r.balance()).isEqualTo(1_000L);
            assertThat(r.balanceInDisplayCurrency()).isNull();
        });
    }

    @Test
    void should_matchDashboardNetWorth_when_summingActiveConvertedBalances() {
        seedRates();
        accountService.create(new CreateAccountRequest("UAH", Currency.UAH, 123_457L));
        accountService.create(new CreateAccountRequest("USD", Currency.USD, 1_001L));
        accountService.create(new CreateAccountRequest("EUR", Currency.EUR, 777L));
        accountService.create(new CreateAccountRequest("GBP", Currency.GBP, 5_000L));
        var inactive = accountService.create(new CreateAccountRequest("Old USD", Currency.USD, 9_999L));
        accountService.update(inactive.getId(), new UpdateAccountRequest("Old USD", Currency.USD, false));

        var sum = accountService.findAllWithConvertedBalance().stream()
                .filter(AccountResponse::active)
                .filter(a -> a.balanceInDisplayCurrency() != null)
                .mapToLong(AccountResponse::balanceInDisplayCurrency)
                .sum();

        assertThat(sum).isEqualTo(dashboardService.getDashboard().totalNetWorth());
    }
}
