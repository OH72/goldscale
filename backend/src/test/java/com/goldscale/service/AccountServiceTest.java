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

        var result = accountService.update("acc-1", new UpdateAccountRequest("New Name"));

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

        assertThatThrownBy(() -> accountService.update("acc-1", new UpdateAccountRequest("Taken")))
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

        var result = accountService.update("acc-1", new UpdateAccountRequest("Same"));

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
}
