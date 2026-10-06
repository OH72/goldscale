package com.goldscale.service;

import com.goldscale.dto.request.CreateAccountRequest;
import com.goldscale.dto.request.UpdateAccountRequest;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.Account;
import com.goldscale.model.Currency;
import com.goldscale.repository.AccountRepository;
import com.goldscale.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import com.goldscale.model.Settings;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountServiceTest {

    @Mock private AccountRepository accountRepository;
    @Mock private TransactionRepository transactionRepository;
    @Mock private MongoTemplate mongoTemplate;
    @Mock private SettingsService settingsService;
    @Mock private ExchangeRateService exchangeRateService;

    @InjectMocks private AccountService accountService;

    @Test
    void should_createAccountAndInitialBalance_when_validRequest() {
        var request = new CreateAccountRequest("Test", Currency.UAH, 100000L);
        var savedAccount = new Account();
        savedAccount.setId("acc-1");
        savedAccount.setName("Test");
        savedAccount.setCurrency(Currency.UAH);
        savedAccount.setBalance(100000L);

        when(accountRepository.existsByName("Test")).thenReturn(false);
        when(accountRepository.save(any(Account.class))).thenReturn(savedAccount);

        var result = accountService.create(request);

        assertThat(result.getName()).isEqualTo("Test");
        assertThat(result.getBalance()).isEqualTo(100000L);
        verify(transactionRepository).save(any());
    }

    @Test
    void should_throwBusinessRule_when_duplicateName() {
        var request = new CreateAccountRequest("Existing", Currency.UAH, 0L);
        when(accountRepository.existsByName("Existing")).thenReturn(true);

        assertThatThrownBy(() -> accountService.create(request))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void should_throwNotFound_when_accountDoesNotExist() {
        when(accountRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> accountService.findById("missing"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void should_updateName_when_validRequest() {
        var account = new Account();
        account.setId("acc-1");
        account.setName("Old Name");

        when(accountRepository.findById("acc-1")).thenReturn(Optional.of(account));
        when(accountRepository.findByName("New Name")).thenReturn(Optional.empty());
        when(accountRepository.save(any())).thenReturn(account);

        var result = accountService.update("acc-1", new UpdateAccountRequest("New Name", Currency.UAH, true));

        assertThat(result.getName()).isEqualTo("New Name");
    }

    @Test
    void should_throwBusinessRule_when_updateToDuplicateName() {
        var account = new Account();
        account.setId("acc-1");
        account.setName("Old");

        var other = new Account();
        other.setId("acc-2");
        other.setName("Taken");

        when(accountRepository.findById("acc-1")).thenReturn(Optional.of(account));
        when(accountRepository.findByName("Taken")).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> accountService.update("acc-1", new UpdateAccountRequest("Taken", Currency.UAH, true)))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void should_allowSameName_when_updatingSelf() {
        var account = new Account();
        account.setId("acc-1");
        account.setName("Same");

        when(accountRepository.findById("acc-1")).thenReturn(Optional.of(account));
        when(accountRepository.findByName("Same")).thenReturn(Optional.of(account));
        when(accountRepository.save(any())).thenReturn(account);

        var result = accountService.update("acc-1", new UpdateAccountRequest("Same", Currency.UAH, true));

        assertThat(result.getName()).isEqualTo("Same");
    }

    @Test
    void should_softDeleteTransactionsAndRemoveAccount_when_deleting() {
        var account = new Account();
        account.setId("acc-1");

        when(accountRepository.findById("acc-1")).thenReturn(Optional.of(account));

        accountService.delete("acc-1");

        verify(mongoTemplate, times(2)).updateMulti(any(), any(), eq(com.goldscale.model.Transaction.class));
        verify(accountRepository).delete(account);
    }

    // ---- findAllWithConvertedBalance ----

    private static final Map<String, Long> RATES = Map.of(
            "USD", 1_000_000L, "UAH", 25_000L, "EUR", 1_100_000L, "GBP", 0L);

    private void givenDisplayCurrency(Currency currency, Map<String, Long> rates) {
        var settings = new Settings();
        settings.setDisplayCurrency(currency);
        when(settingsService.get()).thenReturn(settings);
        when(exchangeRateService.getLatestRates()).thenReturn(rates);
        when(exchangeRateService.convertWithRates(anyLong(), any(), any(), any())).thenCallRealMethod();
    }

    private Account account(String id, Currency currency, long balance, boolean active) {
        var account = new Account();
        account.setId(id);
        account.setName(id);
        account.setCurrency(currency);
        account.setBalance(balance);
        account.setActive(active);
        return account;
    }

    @Test
    void should_returnUnchangedBalance_when_sameCurrencyAsDisplay() {
        givenDisplayCurrency(Currency.UAH, RATES);
        when(accountRepository.findAll()).thenReturn(List.of(account("a", Currency.UAH, 12345L, true)));

        var result = accountService.findAllWithConvertedBalance();

        assertThat(result).singleElement().satisfies(r -> {
            assertThat(r.balance()).isEqualTo(12345L);
            assertThat(r.balanceInDisplayCurrency()).isEqualTo(12345L);
        });
    }

    @Test
    void should_returnConvertedBalance_when_ratesAvailable() {
        givenDisplayCurrency(Currency.UAH, RATES);
        when(accountRepository.findAll()).thenReturn(List.of(account("a", Currency.USD, 1000L, true)));

        var result = accountService.findAllWithConvertedBalance();

        // 1000 * 1_000_000 / 25_000 = 40_000
        assertThat(result.getFirst().balanceInDisplayCurrency()).isEqualTo(40_000L);
        assertThat(result.getFirst().balance()).isEqualTo(1000L);
    }

    @Test
    void should_returnNullConvertedBalance_when_rateMissing() {
        givenDisplayCurrency(Currency.UAH, RATES);
        when(accountRepository.findAll()).thenReturn(List.of(account("a", Currency.PLN, 1000L, true)));

        var result = accountService.findAllWithConvertedBalance();

        assertThat(result.getFirst().balanceInDisplayCurrency()).isNull();
    }

    @Test
    void should_returnNullConvertedBalance_when_rateIsZero() {
        givenDisplayCurrency(Currency.UAH, RATES);
        when(accountRepository.findAll()).thenReturn(List.of(account("a", Currency.GBP, 1000L, true)));

        var result = accountService.findAllWithConvertedBalance();

        assertThat(result.getFirst().balanceInDisplayCurrency()).isNull();
    }

    @Test
    void should_includeInactiveAccounts_when_convertingBalances() {
        givenDisplayCurrency(Currency.UAH, RATES);
        when(accountRepository.findAll()).thenReturn(List.of(account("a", Currency.USD, 1000L, false)));

        var result = accountService.findAllWithConvertedBalance();

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().active()).isFalse();
        assertThat(result.getFirst().balanceInDisplayCurrency()).isEqualTo(40_000L);
    }
}
