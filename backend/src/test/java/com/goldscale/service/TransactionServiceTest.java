package com.goldscale.service;

import com.goldscale.dto.request.TransactionCommand.CreateExpense;
import com.goldscale.dto.request.TransactionCommand.CreateIncome;
import com.goldscale.dto.request.TransactionCommand.CreateTransfer;
import com.goldscale.dto.request.UpdateTransactionRequest;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.*;
import com.goldscale.repository.AccountRepository;
import com.goldscale.repository.CategoryRepository;
import com.goldscale.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    @Mock private TransactionRepository transactionRepository;
    @Mock private AccountRepository accountRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private BalanceService balanceService;
    @Mock private MongoTemplate mongoTemplate;

    @InjectMocks private TransactionService transactionService;

    @Test
    void should_adjustBalancePositive_when_incomeCreated() {
        var incomeCategory = new Category();
        incomeCategory.setId("cat-1");
        incomeCategory.setType(CategoryType.INCOME);

        var savedTxn = new Transaction();
        savedTxn.setId("txn-1");
        savedTxn.setType(TransactionType.INCOME);
        savedTxn.setAccountId("acc-1");
        savedTxn.setAmount(5000L);

        var account = new Account();
        account.setId("acc-1");
        account.setName("Test");

        when(accountRepository.existsById("acc-1")).thenReturn(true);
        when(categoryRepository.findById("cat-1")).thenReturn(Optional.of(incomeCategory));
        when(transactionRepository.save(any())).thenReturn(savedTxn);
        when(balanceService.calculateDelta(TransactionType.INCOME, 5000L)).thenReturn(5000L);
        when(accountRepository.findAllById(any())).thenReturn(java.util.List.of(account));

        transactionService.create(new CreateIncome("acc-1", 5000L, "cat-1", LocalDate.now(), null));

        verify(balanceService).adjustBalance("acc-1", 5000L);
    }

    @Test
    void should_adjustBalanceNegative_when_expenseCreated() {
        var expenseCategory = new Category();
        expenseCategory.setId("cat-2");
        expenseCategory.setType(CategoryType.EXPENSE);

        var savedTxn = new Transaction();
        savedTxn.setId("txn-2");
        savedTxn.setType(TransactionType.EXPENSE);
        savedTxn.setAccountId("acc-1");
        savedTxn.setAmount(3000L);

        var account = new Account();
        account.setId("acc-1");
        account.setName("Test");

        when(accountRepository.existsById("acc-1")).thenReturn(true);
        when(categoryRepository.findById("cat-2")).thenReturn(Optional.of(expenseCategory));
        when(transactionRepository.save(any())).thenReturn(savedTxn);
        when(balanceService.calculateDelta(TransactionType.EXPENSE, 3000L)).thenReturn(-3000L);
        when(accountRepository.findAllById(any())).thenReturn(java.util.List.of(account));

        transactionService.create(new CreateExpense("acc-1", 3000L, "cat-2", LocalDate.now(), null));

        verify(balanceService).adjustBalance("acc-1", -3000L);
    }

    @Test
    void should_throwBusinessRule_when_categoryTypeMismatch() {
        var expenseCategory = new Category();
        expenseCategory.setId("cat-exp");
        expenseCategory.setName("Food");
        expenseCategory.setType(CategoryType.EXPENSE);

        when(accountRepository.existsById("acc-1")).thenReturn(true);
        when(categoryRepository.findById("cat-exp")).thenReturn(Optional.of(expenseCategory));

        assertThatThrownBy(() -> transactionService.create(
                new CreateIncome("acc-1", 1000L, "cat-exp", LocalDate.now(), null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("EXPENSE but expected INCOME");
    }

    @Test
    void should_throwNotFound_when_accountDoesNotExist() {
        when(accountRepository.existsById("missing")).thenReturn(false);

        assertThatThrownBy(() -> transactionService.create(
                new CreateIncome("missing", 1000L, "cat-1", LocalDate.now(), null)))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void should_throwNotFound_when_categoryDoesNotExist() {
        when(accountRepository.existsById("acc-1")).thenReturn(true);
        when(categoryRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> transactionService.create(
                new CreateIncome("acc-1", 1000L, "missing", LocalDate.now(), null)))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void should_throwBusinessRule_when_deletingInitialBalance() {
        var txn = new Transaction();
        txn.setId("txn-init");
        txn.setType(TransactionType.INITIAL_BALANCE);
        txn.setDeleted(false);

        when(transactionRepository.findByIdAndDeletedFalse("txn-init")).thenReturn(Optional.of(txn));

        assertThatThrownBy(() -> transactionService.delete("txn-init"))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("INITIAL_BALANCE");
    }

    @Test
    void should_reverseBalance_when_incomeDeleted() {
        var txn = new Transaction();
        txn.setId("txn-1");
        txn.setType(TransactionType.INCOME);
        txn.setAccountId("acc-1");
        txn.setAmount(5000L);
        txn.setDeleted(false);

        when(transactionRepository.findByIdAndDeletedFalse("txn-1")).thenReturn(Optional.of(txn));

        transactionService.delete("txn-1");

        verify(balanceService).adjustBalance("acc-1", -5000L);
        verify(transactionRepository).save(argThat(t -> t.isDeleted()));
    }

    @Test
    void should_reverseBalance_when_expenseDeleted() {
        var txn = new Transaction();
        txn.setId("txn-2");
        txn.setType(TransactionType.EXPENSE);
        txn.setAccountId("acc-1");
        txn.setAmount(3000L);
        txn.setDeleted(false);

        when(transactionRepository.findByIdAndDeletedFalse("txn-2")).thenReturn(Optional.of(txn));

        transactionService.delete("txn-2");

        verify(balanceService).adjustBalance("acc-1", 3000L);
    }

    @Test
    void should_adjustByDelta_when_incomeAmountEdited() {
        var txn = new Transaction();
        txn.setId("txn-1");
        txn.setType(TransactionType.INCOME);
        txn.setAccountId("acc-1");
        txn.setAmount(5000L);
        txn.setCategoryId("cat-1");
        txn.setDeleted(false);

        var incomeCategory = new Category();
        incomeCategory.setId("cat-1");
        incomeCategory.setType(CategoryType.INCOME);

        var account = new Account();
        account.setId("acc-1");
        account.setName("Test");

        when(transactionRepository.findByIdAndDeletedFalse("txn-1")).thenReturn(Optional.of(txn));
        when(categoryRepository.findById("cat-1")).thenReturn(Optional.of(incomeCategory));
        when(transactionRepository.save(any())).thenReturn(txn);
        when(balanceService.calculateDelta(TransactionType.INCOME, 5000L)).thenReturn(5000L);
        when(balanceService.calculateDelta(TransactionType.INCOME, 8000L)).thenReturn(8000L);
        when(accountRepository.findAllById(any())).thenReturn(java.util.List.of(account));

        transactionService.update("txn-1", new UpdateTransactionRequest(
                8000L, "cat-1", LocalDate.now(), "updated", null));

        // delta = 8000 - 5000 = 3000
        verify(balanceService).adjustBalance("acc-1", 3000L);
    }

    @Test
    void should_adjustBothBalances_when_transferCreated() {
        var savedTxn = new Transaction();
        savedTxn.setId("txn-t1");
        savedTxn.setType(TransactionType.TRANSFER);
        savedTxn.setAccountId("acc-1");
        savedTxn.setTargetAccountId("acc-2");
        savedTxn.setAmount(50000L);
        savedTxn.setTargetAmount(1350L);

        var acc1 = new Account();
        acc1.setId("acc-1");
        acc1.setName("UAH");
        var acc2 = new Account();
        acc2.setId("acc-2");
        acc2.setName("USD");

        when(accountRepository.existsById("acc-1")).thenReturn(true);
        when(accountRepository.existsById("acc-2")).thenReturn(true);
        when(transactionRepository.save(any())).thenReturn(savedTxn);
        when(accountRepository.findAllById(any())).thenReturn(java.util.List.of(acc1, acc2));

        transactionService.create(new CreateTransfer(
                "acc-1", "acc-2", 50000L, 1350L, LocalDate.now(), "transfer"));

        verify(balanceService).adjustBalance("acc-1", -50000L);
        verify(balanceService).adjustBalance("acc-2", 1350L);
    }

    @Test
    void should_throwBusinessRule_when_transferToSameAccount() {
        when(accountRepository.existsById("acc-1")).thenReturn(true);

        assertThatThrownBy(() -> transactionService.create(
                new CreateTransfer("acc-1", "acc-1", 1000L, 1000L, LocalDate.now(), null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("different");
    }

    @Test
    void should_throwNotFound_when_transferTargetAccountMissing() {
        when(accountRepository.existsById("acc-1")).thenReturn(true);
        when(accountRepository.existsById("missing")).thenReturn(false);

        assertThatThrownBy(() -> transactionService.create(
                new CreateTransfer("acc-1", "missing", 1000L, 1000L, LocalDate.now(), null)))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void should_reverseBothBalances_when_transferDeleted() {
        var txn = new Transaction();
        txn.setId("txn-t1");
        txn.setType(TransactionType.TRANSFER);
        txn.setAccountId("acc-1");
        txn.setTargetAccountId("acc-2");
        txn.setAmount(50000L);
        txn.setTargetAmount(1350L);
        txn.setDeleted(false);

        when(transactionRepository.findByIdAndDeletedFalse("txn-t1")).thenReturn(Optional.of(txn));

        transactionService.delete("txn-t1");

        verify(balanceService).adjustBalance("acc-1", 50000L);
        verify(balanceService).adjustBalance("acc-2", -1350L);
        verify(transactionRepository).save(argThat(Transaction::isDeleted));
    }

    @Test
    void should_adjustBothByDelta_when_transferEdited() {
        var txn = new Transaction();
        txn.setId("txn-t1");
        txn.setType(TransactionType.TRANSFER);
        txn.setAccountId("acc-1");
        txn.setTargetAccountId("acc-2");
        txn.setAmount(50000L);
        txn.setTargetAmount(1350L);
        txn.setDeleted(false);

        var acc1 = new Account();
        acc1.setId("acc-1");
        acc1.setName("UAH");
        var acc2 = new Account();
        acc2.setId("acc-2");
        acc2.setName("USD");

        when(transactionRepository.findByIdAndDeletedFalse("txn-t1")).thenReturn(Optional.of(txn));
        when(transactionRepository.save(any())).thenReturn(txn);
        when(accountRepository.findAllById(any())).thenReturn(java.util.List.of(acc1, acc2));

        transactionService.update("txn-t1", new UpdateTransactionRequest(
                60000L, null, LocalDate.now(), "updated", 1600L));

        // source: -(60000 - 50000) = -10000
        verify(balanceService).adjustBalance("acc-1", -10000L);
        // target: 1600 - 1350 = 250
        verify(balanceService).adjustBalance("acc-2", 250L);
    }
}
