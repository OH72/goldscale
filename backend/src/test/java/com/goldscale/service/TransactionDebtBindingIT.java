package com.goldscale.service;

import com.goldscale.config.TestcontainersConfig;
import com.goldscale.dto.request.*;
import com.goldscale.dto.request.TransactionCommand.CreateExpense;
import com.goldscale.dto.request.TransactionCommand.CreateIncome;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.*;
import com.goldscale.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfig.class)
class TransactionDebtBindingIT {

    @Autowired private TransactionService transactionService;
    @Autowired private DebtRecordService debtRecordService;
    @Autowired private AccountService accountService;
    @Autowired private CategoryService categoryService;
    @Autowired private PersonService personService;
    @Autowired private AccountRepository accountRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private TransactionRepository transactionRepository;
    @Autowired private DebtRecordRepository debtRecordRepository;
    @Autowired private PersonRepository personRepository;

    private String accountId;
    private String personId;
    private String incomeCategoryId;
    private String expenseCategoryId;
    private static final LocalDate DATE = LocalDate.of(2026, 10, 15);

    @BeforeEach
    void setUp() {
        transactionRepository.deleteAll();
        debtRecordRepository.deleteAll();
        accountRepository.deleteAll();
        categoryRepository.deleteAll();
        personRepository.deleteAll();

        var account = accountService.create(new CreateAccountRequest("Main", Currency.UAH, 1000000L));
        accountId = account.getId();
        incomeCategoryId = categoryService.create(
                new CreateCategoryRequest("Salary", CategoryType.INCOME, null)).getId();
        expenseCategoryId = categoryService.create(
                new CreateCategoryRequest("Food", CategoryType.EXPENSE, null)).getId();
        personId = personService.create(new CreatePersonRequest("Alice")).getId();
    }

    // --- UC1: Link transaction to existing debt ---

    @Test
    void should_createPaymentOnDebt_when_expenseLinkedToOpenDebt() {
        var debt = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 500000L, Currency.UAH, null, "borrowed money", DATE));

        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 200000L, expenseCategoryId, DATE, "paying back",
                null, debt.id(), null, null));

        assertThat(txnResponse.debtRecordId()).isEqualTo(debt.id());
        assertThat(txnResponse.paymentId()).isNotNull();

        var updatedDebt = debtRecordService.findById(debt.id());
        assertThat(updatedDebt.coveredAmount()).isEqualTo(200000L);
        assertThat(updatedDebt.remainingAmount()).isEqualTo(300000L);
        assertThat(updatedDebt.status()).isEqualTo(DebtStatus.OPEN);
        assertThat(updatedDebt.payments()).hasSize(1);
        assertThat(updatedDebt.payments().getFirst().transactionId()).isEqualTo(txnResponse.id());

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(800000L); // 1000000 - 200000
    }

    @Test
    void should_createPaymentOnLoan_when_incomeLinkedToOpenLoan() {
        var loan = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.LOAN, 300000L, Currency.UAH, null, "lent money", DATE));

        var txnResponse = transactionService.create(new CreateIncome(
                accountId, 100000L, incomeCategoryId, DATE, "partial repayment",
                null, loan.id(), null, null));

        assertThat(txnResponse.debtRecordId()).isEqualTo(loan.id());
        assertThat(txnResponse.paymentId()).isNotNull();

        var updatedLoan = debtRecordService.findById(loan.id());
        assertThat(updatedLoan.coveredAmount()).isEqualTo(100000L);
        assertThat(updatedLoan.status()).isEqualTo(DebtStatus.OPEN);

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(1100000L); // 1000000 + 100000
    }

    @Test
    void should_autoCloseDebt_when_paymentCoversFullRemaining() {
        var debt = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 200000L, Currency.UAH, null, "exact payoff", DATE));

        transactionService.create(new CreateExpense(
                accountId, 200000L, expenseCategoryId, DATE, "full payment",
                null, debt.id(), null, null));

        var updatedDebt = debtRecordService.findById(debt.id());
        assertThat(updatedDebt.coveredAmount()).isEqualTo(200000L);
        assertThat(updatedDebt.status()).isEqualTo(DebtStatus.CLOSED);
    }

    @Test
    void should_reject_when_paymentExceedsRemaining() {
        var debt = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 100000L, Currency.UAH, null, "small debt", DATE));

        assertThatThrownBy(() -> transactionService.create(new CreateExpense(
                accountId, 200000L, expenseCategoryId, DATE, "too much",
                null, debt.id(), null, null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("exceeds remaining");
    }

    @Test
    void should_reject_when_linkingToClosedDebt() {
        var debt = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 100000L, Currency.UAH, null, "closed", DATE));
        debtRecordService.toggleStatus(debt.id()); // close it

        assertThatThrownBy(() -> transactionService.create(new CreateExpense(
                accountId, 50000L, expenseCategoryId, DATE, "paying closed",
                null, debt.id(), null, null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("closed");
    }

    @Test
    void should_reject_when_expenseLinkedToLoan() {
        var loan = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.LOAN, 300000L, Currency.UAH, null, "wrong type", DATE));

        assertThatThrownBy(() -> transactionService.create(new CreateExpense(
                accountId, 100000L, expenseCategoryId, DATE, "wrong link",
                null, loan.id(), null, null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Expected DEBT");
    }

    @Test
    void should_reject_when_incomeLinkedToDebt() {
        var debt = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 300000L, Currency.UAH, null, "wrong type", DATE));

        assertThatThrownBy(() -> transactionService.create(new CreateIncome(
                accountId, 100000L, incomeCategoryId, DATE, "wrong link",
                null, debt.id(), null, null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Expected LOAN");
    }

    @Test
    void should_reject_when_debtRecordIdAndPersonIdBothProvided() {
        assertThatThrownBy(() -> transactionService.create(new CreateExpense(
                accountId, 100000L, expenseCategoryId, DATE, "both set",
                null, "someDebtId", personId, null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Cannot set both");
    }

    // --- UC2: Create DEBT from INCOME ---

    @Test
    void should_createNewDebt_when_incomeWithPersonId() {
        var txnResponse = transactionService.create(new CreateIncome(
                accountId, 500000L, incomeCategoryId, DATE, "friend lent me money",
                null, null, personId, null));

        assertThat(txnResponse.debtRecordId()).isNotNull();
        assertThat(txnResponse.paymentId()).isNull(); // no payment, just a new debt

        var debt = debtRecordService.findById(txnResponse.debtRecordId());
        assertThat(debt.type()).isEqualTo(DebtType.DEBT);
        assertThat(debt.amount()).isEqualTo(500000L);
        assertThat(debt.coveredAmount()).isEqualTo(0L);
        assertThat(debt.currency()).isEqualTo(Currency.UAH);
        assertThat(debt.personName()).isEqualTo("Alice");
        assertThat(debt.status()).isEqualTo(DebtStatus.OPEN);

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(1500000L); // 1000000 + 500000
    }

    // --- UC3: Create LOAN from EXPENSE ---

    @Test
    void should_createNewLoan_when_expenseWithPersonId() {
        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 50000L, expenseCategoryId, DATE, "bought dinner for Alice",
                null, null, personId, null));

        assertThat(txnResponse.debtRecordId()).isNotNull();
        assertThat(txnResponse.paymentId()).isNull();

        var loan = debtRecordService.findById(txnResponse.debtRecordId());
        assertThat(loan.type()).isEqualTo(DebtType.LOAN);
        assertThat(loan.amount()).isEqualTo(50000L);
        assertThat(loan.coveredAmount()).isEqualTo(0L);
        assertThat(loan.personName()).isEqualTo("Alice");

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(950000L); // 1000000 - 50000
    }

    // --- Edit cascade ---

    @Test
    void should_updatePayment_when_linkedTransactionEdited() {
        var debt = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 500000L, Currency.UAH, null, "big debt", DATE));

        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 200000L, expenseCategoryId, DATE, "partial payment",
                null, debt.id(), null, null));

        // Edit: change amount from 200000 to 300000
        transactionService.update(txnResponse.id(), new UpdateTransactionRequest(
                300000L, expenseCategoryId, DATE, "updated payment", null));

        var updatedDebt = debtRecordService.findById(debt.id());
        assertThat(updatedDebt.coveredAmount()).isEqualTo(300000L);
        assertThat(updatedDebt.payments().getFirst().amount()).isEqualTo(300000L);
        assertThat(updatedDebt.status()).isEqualTo(DebtStatus.OPEN);

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(700000L); // 1000000 - 300000
    }

    @Test
    void should_updateDebtAmount_when_originatingTransactionEdited() {
        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 50000L, expenseCategoryId, DATE, "dinner for Alice",
                null, null, personId, null));

        // Edit: change amount from 50000 to 80000
        transactionService.update(txnResponse.id(), new UpdateTransactionRequest(
                80000L, expenseCategoryId, DATE, "dinner was expensive", null));

        var loan = debtRecordService.findById(txnResponse.debtRecordId());
        assertThat(loan.amount()).isEqualTo(80000L);

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(920000L); // 1000000 - 80000
    }

    // --- Delete cascade ---

    @Test
    void should_removePayment_when_linkedTransactionDeleted() {
        var debt = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 500000L, Currency.UAH, null, "debt", DATE));

        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 200000L, expenseCategoryId, DATE, "payment",
                null, debt.id(), null, null));

        transactionService.delete(txnResponse.id());

        var updatedDebt = debtRecordService.findById(debt.id());
        assertThat(updatedDebt.coveredAmount()).isEqualTo(0L);
        assertThat(updatedDebt.payments()).isEmpty();
        assertThat(updatedDebt.status()).isEqualTo(DebtStatus.OPEN);

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(1000000L); // restored
    }

    @Test
    void should_deleteDebtRecord_when_originatingTransactionDeletedAndNoPayments() {
        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 50000L, expenseCategoryId, DATE, "dinner for Alice",
                null, null, personId, null));

        var debtId = txnResponse.debtRecordId();
        transactionService.delete(txnResponse.id());

        assertThatThrownBy(() -> debtRecordService.findById(debtId))
                .isInstanceOf(ResourceNotFoundException.class);

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(1000000L); // restored
    }

    @Test
    void should_reject_when_deletingOriginatingTransactionWithPayments() {
        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 50000L, expenseCategoryId, DATE, "dinner for Alice",
                null, null, personId, null));

        // Manually add a payment to the created loan
        debtRecordService.addPayment(txnResponse.debtRecordId(),
                new AddPaymentRequest(10000L, DATE, "partial return"));

        assertThatThrownBy(() -> transactionService.delete(txnResponse.id()))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("has existing payments");
    }

    // --- Cross-currency ---

    @Test
    void should_useDebtAmount_when_crossCurrencyLinking() {
        // Create USD account and a UAH debt
        var usdAccount = accountService.create(new CreateAccountRequest("USD", Currency.USD, 100000L));
        var debt = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 500000L, Currency.UAH, null, "UAH debt", DATE));

        // Pay with USD, provide debtAmount in UAH
        var txnResponse = transactionService.create(new CreateExpense(
                usdAccount.getId(), 5000L, expenseCategoryId, DATE, "cross-currency payment",
                null, debt.id(), null, 200000L));

        assertThat(txnResponse.debtRecordId()).isEqualTo(debt.id());

        var updatedDebt = debtRecordService.findById(debt.id());
        assertThat(updatedDebt.coveredAmount()).isEqualTo(200000L); // UAH amount
        assertThat(updatedDebt.payments().getFirst().amount()).isEqualTo(200000L);

        var account = accountRepository.findById(usdAccount.getId()).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(95000L); // 100000 - 5000 USD
    }
}
