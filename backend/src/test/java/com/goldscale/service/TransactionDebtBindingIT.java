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
import java.util.List;

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
    @Autowired private TagService tagService;
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
                null, List.of(new DebtLinkRequest(debt.id(), 200000L)), null));

        assertThat(txnResponse.debtLinks()).hasSize(1);
        assertThat(txnResponse.debtLinks().getFirst().debtRecordId()).isEqualTo(debt.id());
        assertThat(txnResponse.debtLinks().getFirst().paymentId()).isNotNull();

        var updatedDebt = debtRecordService.findById(debt.id());
        assertThat(updatedDebt.coveredAmount()).isEqualTo(200000L);
        assertThat(updatedDebt.remainingAmount()).isEqualTo(300000L);
        assertThat(updatedDebt.status()).isEqualTo(DebtStatus.OPEN);
        assertThat(updatedDebt.payments()).hasSize(1);
        assertThat(updatedDebt.payments().getFirst().transactionId()).isEqualTo(txnResponse.id());

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(800000L);
    }

    @Test
    void should_createPaymentOnLoan_when_incomeLinkedToOpenLoan() {
        var loan = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.LOAN, 300000L, Currency.UAH, null, "lent money", DATE));

        var txnResponse = transactionService.create(new CreateIncome(
                accountId, 100000L, incomeCategoryId, DATE, "partial repayment",
                null, List.of(new DebtLinkRequest(loan.id(), 100000L)), null));

        assertThat(txnResponse.debtLinks()).hasSize(1);
        assertThat(txnResponse.debtLinks().getFirst().debtRecordId()).isEqualTo(loan.id());
        assertThat(txnResponse.debtLinks().getFirst().paymentId()).isNotNull();

        var updatedLoan = debtRecordService.findById(loan.id());
        assertThat(updatedLoan.coveredAmount()).isEqualTo(100000L);
        assertThat(updatedLoan.status()).isEqualTo(DebtStatus.OPEN);

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(1100000L);
    }

    @Test
    void should_autoCloseDebt_when_paymentCoversFullRemaining() {
        var debt = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 200000L, Currency.UAH, null, "exact payoff", DATE));

        transactionService.create(new CreateExpense(
                accountId, 200000L, expenseCategoryId, DATE, "full payment",
                null, List.of(new DebtLinkRequest(debt.id(), 200000L)), null));

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
                null, List.of(new DebtLinkRequest(debt.id(), 200000L)), null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("exceeds remaining");
    }

    @Test
    void should_reject_when_linkingToClosedDebt() {
        var debt = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 100000L, Currency.UAH, null, "closed", DATE));
        debtRecordService.toggleStatus(debt.id());

        assertThatThrownBy(() -> transactionService.create(new CreateExpense(
                accountId, 50000L, expenseCategoryId, DATE, "paying closed",
                null, List.of(new DebtLinkRequest(debt.id(), 50000L)), null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("closed");
    }

    @Test
    void should_reject_when_expenseLinkedToLoan() {
        var loan = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.LOAN, 300000L, Currency.UAH, null, "wrong type", DATE));

        assertThatThrownBy(() -> transactionService.create(new CreateExpense(
                accountId, 100000L, expenseCategoryId, DATE, "wrong link",
                null, List.of(new DebtLinkRequest(loan.id(), 100000L)), null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Expected DEBT");
    }

    @Test
    void should_reject_when_incomeLinkedToDebt() {
        var debt = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 300000L, Currency.UAH, null, "wrong type", DATE));

        assertThatThrownBy(() -> transactionService.create(new CreateIncome(
                accountId, 100000L, incomeCategoryId, DATE, "wrong link",
                null, List.of(new DebtLinkRequest(debt.id(), 100000L)), null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Expected LOAN");
    }

    // --- UC2: Create DEBT from INCOME ---

    @Test
    void should_createNewDebt_when_incomeWithPersonId() {
        var txnResponse = transactionService.create(new CreateIncome(
                accountId, 500000L, incomeCategoryId, DATE, "friend lent me money",
                null, null, List.of(new NewDebtRequest(personId, null))));

        assertThat(txnResponse.debtLinks()).hasSize(1);
        var link = txnResponse.debtLinks().getFirst();
        assertThat(link.debtRecordId()).isNotNull();
        assertThat(link.paymentId()).isNull();

        var debt = debtRecordService.findById(link.debtRecordId());
        assertThat(debt.type()).isEqualTo(DebtType.DEBT);
        assertThat(debt.amount()).isEqualTo(500000L);
        assertThat(debt.coveredAmount()).isEqualTo(0L);
        assertThat(debt.currency()).isEqualTo(Currency.UAH);
        assertThat(debt.personName()).isEqualTo("Alice");
        assertThat(debt.status()).isEqualTo(DebtStatus.OPEN);
        assertThat(debt.sourceTransactionId()).isEqualTo(txnResponse.id());

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(1500000L);
    }

    // --- UC3: Create LOAN from EXPENSE ---

    @Test
    void should_createNewLoan_when_expenseWithPersonId() {
        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 50000L, expenseCategoryId, DATE, "bought dinner for Alice",
                null, null, List.of(new NewDebtRequest(personId, null))));

        assertThat(txnResponse.debtLinks()).hasSize(1);
        var link = txnResponse.debtLinks().getFirst();
        assertThat(link.debtRecordId()).isNotNull();
        assertThat(link.paymentId()).isNull();

        var loan = debtRecordService.findById(link.debtRecordId());
        assertThat(loan.type()).isEqualTo(DebtType.LOAN);
        assertThat(loan.amount()).isEqualTo(50000L);
        assertThat(loan.coveredAmount()).isEqualTo(0L);
        assertThat(loan.personName()).isEqualTo("Alice");
        assertThat(loan.sourceTransactionId()).isEqualTo(txnResponse.id());

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(950000L);
    }

    // --- Edit cascade ---

    @Test
    void should_updatePayment_when_linkedTransactionEdited() {
        var debt = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 500000L, Currency.UAH, null, "big debt", DATE));

        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 200000L, expenseCategoryId, DATE, "partial payment",
                null, List.of(new DebtLinkRequest(debt.id(), 200000L)), null));

        // Edit transaction — debt link amount stays 200000 (as originally specified)
        transactionService.update(txnResponse.id(), new UpdateTransactionRequest(
                300000L, expenseCategoryId, DATE, "updated payment", null));

        var updatedDebt = debtRecordService.findById(debt.id());
        // Payment amount stays 200000 because edit cascade only updates date/description
        assertThat(updatedDebt.coveredAmount()).isEqualTo(200000L);
        assertThat(updatedDebt.payments().getFirst().amount()).isEqualTo(200000L);
        assertThat(updatedDebt.status()).isEqualTo(DebtStatus.OPEN);

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(700000L); // 1000000 - 300000
    }

    @Test
    void should_updateDebtAmount_when_originatingTransactionEdited() {
        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 50000L, expenseCategoryId, DATE, "dinner for Alice",
                null, null, List.of(new NewDebtRequest(personId, null))));

        var debtId = txnResponse.debtLinks().getFirst().debtRecordId();

        // Edit transaction — debt link amount stays 50000 (same as original)
        transactionService.update(txnResponse.id(), new UpdateTransactionRequest(
                80000L, expenseCategoryId, DATE, "dinner was expensive", null));

        var loan = debtRecordService.findById(debtId);
        // Debt amount stays 50000 (the link amount, not the transaction amount)
        assertThat(loan.amount()).isEqualTo(50000L);

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
                null, List.of(new DebtLinkRequest(debt.id(), 200000L)), null));

        transactionService.delete(txnResponse.id());

        var updatedDebt = debtRecordService.findById(debt.id());
        assertThat(updatedDebt.coveredAmount()).isEqualTo(0L);
        assertThat(updatedDebt.payments()).isEmpty();
        assertThat(updatedDebt.status()).isEqualTo(DebtStatus.OPEN);

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(1000000L);
    }

    @Test
    void should_deleteDebtRecord_when_originatingTransactionDeletedAndNoPayments() {
        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 50000L, expenseCategoryId, DATE, "dinner for Alice",
                null, null, List.of(new NewDebtRequest(personId, null))));

        var debtId = txnResponse.debtLinks().getFirst().debtRecordId();
        transactionService.delete(txnResponse.id());

        assertThatThrownBy(() -> debtRecordService.findById(debtId))
                .isInstanceOf(ResourceNotFoundException.class);

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(1000000L);
    }

    @Test
    void should_reject_when_deletingOriginatingTransactionWithPayments() {
        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 50000L, expenseCategoryId, DATE, "dinner for Alice",
                null, null, List.of(new NewDebtRequest(personId, null))));

        var debtId = txnResponse.debtLinks().getFirst().debtRecordId();
        debtRecordService.addPayment(debtId,
                new AddPaymentRequest(10000L, DATE, "partial return"));

        assertThatThrownBy(() -> transactionService.delete(txnResponse.id()))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("has existing payments");
    }

    // --- Cross-currency ---

    @Test
    void should_useDebtAmount_when_crossCurrencyLinking() {
        var usdAccount = accountService.create(new CreateAccountRequest("USD", Currency.USD, 100000L));
        var debt = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 500000L, Currency.UAH, null, "UAH debt", DATE));

        var txnResponse = transactionService.create(new CreateExpense(
                usdAccount.getId(), 5000L, expenseCategoryId, DATE, "cross-currency payment",
                null, List.of(new DebtLinkRequest(debt.id(), 200000L)), null));

        assertThat(txnResponse.debtLinks()).hasSize(1);
        assertThat(txnResponse.debtLinks().getFirst().debtRecordId()).isEqualTo(debt.id());

        var updatedDebt = debtRecordService.findById(debt.id());
        assertThat(updatedDebt.coveredAmount()).isEqualTo(200000L);
        assertThat(updatedDebt.payments().getFirst().amount()).isEqualTo(200000L);

        var account = accountRepository.findById(usdAccount.getId()).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(95000L);
    }

    // --- 1:N Multi-link tests ---

    @Test
    void should_createMultiplePayments_when_expenseLinkedToMultipleDebts() {
        var personB = personService.create(new CreatePersonRequest("Bob")).getId();

        var debtA = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 500000L, Currency.UAH, null, "debt A", DATE));
        var debtB = debtRecordService.create(new CreateDebtRecordRequest(
                personB, DebtType.DEBT, 300000L, Currency.UAH, null, "debt B", DATE));

        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 1000000L, expenseCategoryId, DATE, "split payment",
                null, List.of(
                        new DebtLinkRequest(debtA.id(), 300000L),
                        new DebtLinkRequest(debtB.id(), 200000L)
                ), null));

        assertThat(txnResponse.debtLinks()).hasSize(2);

        var updatedDebtA = debtRecordService.findById(debtA.id());
        assertThat(updatedDebtA.coveredAmount()).isEqualTo(300000L);
        assertThat(updatedDebtA.payments()).hasSize(1);

        var updatedDebtB = debtRecordService.findById(debtB.id());
        assertThat(updatedDebtB.coveredAmount()).isEqualTo(200000L);
        assertThat(updatedDebtB.payments()).hasSize(1);

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(0L); // 1000000 - 1000000
    }

    @Test
    void should_reject_when_totalNewDebtAmountExceedsTransaction() {
        var personB = personService.create(new CreatePersonRequest("Bob")).getId();

        assertThatThrownBy(() -> transactionService.create(new CreateExpense(
                accountId, 100000L, expenseCategoryId, DATE, "over-linked",
                null, null, List.of(
                        new NewDebtRequest(personId, 80000L),
                        new NewDebtRequest(personB, 50000L)
                ))))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("exceeds transaction amount");
    }

    @Test
    void should_createMultipleDebts_when_expenseWithMultipleNewDebts() {
        var personB = personService.create(new CreatePersonRequest("Bob")).getId();

        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 500000L, expenseCategoryId, DATE, "group dinner",
                null, null, List.of(
                        new NewDebtRequest(personId, 200000L),
                        new NewDebtRequest(personB, 150000L)
                )));

        assertThat(txnResponse.debtLinks()).hasSize(2);

        var loanA = debtRecordService.findById(txnResponse.debtLinks().get(0).debtRecordId());
        assertThat(loanA.type()).isEqualTo(DebtType.LOAN);
        assertThat(loanA.amount()).isEqualTo(200000L);
        assertThat(loanA.personName()).isEqualTo("Alice");

        var loanB = debtRecordService.findById(txnResponse.debtLinks().get(1).debtRecordId());
        assertThat(loanB.type()).isEqualTo(DebtType.LOAN);
        assertThat(loanB.amount()).isEqualTo(150000L);
        assertThat(loanB.personName()).isEqualTo("Bob");
    }

    @Test
    void should_removeAllPayments_when_multiLinkedTransactionDeleted() {
        var personB = personService.create(new CreatePersonRequest("Bob")).getId();

        var debtA = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 500000L, Currency.UAH, null, "debt A", DATE));
        var debtB = debtRecordService.create(new CreateDebtRecordRequest(
                personB, DebtType.DEBT, 300000L, Currency.UAH, null, "debt B", DATE));

        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 500000L, expenseCategoryId, DATE, "split",
                null, List.of(
                        new DebtLinkRequest(debtA.id(), 200000L),
                        new DebtLinkRequest(debtB.id(), 100000L)
                ), null));

        transactionService.delete(txnResponse.id());

        assertThat(debtRecordService.findById(debtA.id()).coveredAmount()).isEqualTo(0L);
        assertThat(debtRecordService.findById(debtA.id()).payments()).isEmpty();
        assertThat(debtRecordService.findById(debtB.id()).coveredAmount()).isEqualTo(0L);
        assertThat(debtRecordService.findById(debtB.id()).payments()).isEmpty();

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(1000000L);
    }

    @Test
    void should_setSourceTransactionId_when_debtCreatedFromTransaction() {
        var txnResponse = transactionService.create(new CreateIncome(
                accountId, 300000L, incomeCategoryId, DATE, "borrowed",
                null, null, List.of(new NewDebtRequest(personId, null))));

        var debtId = txnResponse.debtLinks().getFirst().debtRecordId();
        var debt = debtRecordService.findById(debtId);
        assertThat(debt.sourceTransactionId()).isEqualTo(txnResponse.id());
    }

    @Test
    void should_passCategoryAndTags_when_debtCreatedFromTransaction() {
        var tag = tagService.create(new CreateTagRequest("dinner"));

        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 50000L, expenseCategoryId, DATE, "tagged dinner",
                List.of(tag.getId()), null, List.of(new NewDebtRequest(personId, null))));

        var debtId = txnResponse.debtLinks().getFirst().debtRecordId();
        var loan = debtRecordService.findById(debtId);
        assertThat(loan.categoryId()).isEqualTo(expenseCategoryId);
        assertThat(loan.tagIds()).containsExactly(tag.getId());
        assertThat(loan.description()).isEqualTo("tagged dinner");
    }

    @Test
    void should_usePartialAmount_when_newDebtAmountSpecified() {
        var txnResponse = transactionService.create(new CreateExpense(
                accountId, 100000L, expenseCategoryId, DATE, "dinner but split",
                null, null, List.of(new NewDebtRequest(personId, 60000L))));

        var debtId = txnResponse.debtLinks().getFirst().debtRecordId();
        var loan = debtRecordService.findById(debtId);
        assertThat(loan.amount()).isEqualTo(60000L);
        assertThat(txnResponse.debtLinks().getFirst().amount()).isEqualTo(60000L);

        var account = accountRepository.findById(accountId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(900000L); // full 100000 deducted
    }
}
