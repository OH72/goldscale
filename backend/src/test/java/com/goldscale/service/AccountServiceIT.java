package com.goldscale.service;

import com.goldscale.config.TestcontainersConfig;
import com.goldscale.dto.request.CreateAccountRequest;
import com.goldscale.model.Currency;
import com.goldscale.model.Transaction;
import com.goldscale.model.TransactionType;
import com.goldscale.repository.AccountRepository;
import com.goldscale.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfig.class)
class AccountServiceIT {

    @Autowired private AccountService accountService;
    @Autowired private AccountRepository accountRepository;
    @Autowired private TransactionRepository transactionRepository;

    @BeforeEach
    void cleanUp() {
        transactionRepository.deleteAll();
        accountRepository.deleteAll();
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
}
