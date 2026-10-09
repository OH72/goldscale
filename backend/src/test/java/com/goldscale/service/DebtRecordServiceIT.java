package com.goldscale.service;

import com.goldscale.config.TestcontainersConfig;
import com.goldscale.dto.request.*;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.*;
import com.goldscale.repository.CategoryRepository;
import com.goldscale.repository.DebtRecordRepository;
import com.goldscale.repository.PersonRepository;
import com.goldscale.repository.SettingsRepository;
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
class DebtRecordServiceIT {

    @Autowired private DebtRecordService debtRecordService;
    @Autowired private PersonService personService;
    @Autowired private CategoryService categoryService;
    @Autowired private SettingsService settingsService;
    @Autowired private DebtRecordRepository debtRecordRepository;
    @Autowired private PersonRepository personRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private SettingsRepository settingsRepository;

    private String personId;

    @BeforeEach
    void cleanUp() {
        debtRecordRepository.deleteAll();
        personRepository.deleteAll();
        categoryRepository.deleteAll();

        // Ensure display currency is UAH for summary tests
        var settings = settingsService.get();
        settings.setDisplayCurrency(Currency.UAH);
        settingsRepository.save(settings);

        var person = personService.create(new CreatePersonRequest("Alice"));
        personId = person.getId();
    }

    @Test
    void should_createRecord_when_valid() {
        var result = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 100000L, Currency.UAH,
                null, "borrowed money", LocalDate.of(2024, 1, 15)));

        assertThat(result.id()).isNotNull();
        assertThat(result.personName()).isEqualTo("Alice");
        assertThat(result.amount()).isEqualTo(100000L);
        assertThat(result.coveredAmount()).isEqualTo(0);
        assertThat(result.remainingAmount()).isEqualTo(100000L);
        assertThat(result.status()).isEqualTo(DebtStatus.OPEN);
        assertThat(result.payments()).isEmpty();
    }

    @Test
    void should_findAllWithFilters() {
        debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 100000L, Currency.UAH, null, "debt1", LocalDate.now()));
        debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.LOAN, 50000L, Currency.UAH, null, "loan1", LocalDate.now()));

        var all = debtRecordService.findAll(null, null, null);
        assertThat(all).hasSize(2);

        var debtsOnly = debtRecordService.findAll(null, DebtType.DEBT, null);
        assertThat(debtsOnly).hasSize(1);
        assertThat(debtsOnly.getFirst().type()).isEqualTo(DebtType.DEBT);

        var loansOnly = debtRecordService.findAll(null, DebtType.LOAN, null);
        assertThat(loansOnly).hasSize(1);
        assertThat(loansOnly.getFirst().type()).isEqualTo(DebtType.LOAN);

        var byPerson = debtRecordService.findAll(personId, null, null);
        assertThat(byPerson).hasSize(2);

        var openOnly = debtRecordService.findAll(null, null, DebtStatus.OPEN);
        assertThat(openOnly).hasSize(2);

        var closedOnly = debtRecordService.findAll(null, null, DebtStatus.CLOSED);
        assertThat(closedOnly).isEmpty();
    }

    @Test
    void should_updateRecord() {
        var created = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 100000L, Currency.UAH, null, "original", LocalDate.now()));

        var updated = debtRecordService.update(created.id(), new UpdateDebtRecordRequest(
                null, null, 200000L, Currency.USD, null, "updated", LocalDate.now()));

        assertThat(updated.amount()).isEqualTo(200000L);
        assertThat(updated.currency()).isEqualTo(Currency.USD);
        assertThat(updated.description()).isEqualTo("updated");
    }

    @Test
    void should_softDeleteRecord() {
        var created = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 100000L, Currency.UAH, null, "to delete", LocalDate.now()));

        debtRecordService.delete(created.id());

        assertThatThrownBy(() -> debtRecordService.findById(created.id()))
                .isInstanceOf(ResourceNotFoundException.class);

        // Should still exist in DB with deleted=true
        var raw = debtRecordRepository.findById(created.id()).orElseThrow();
        assertThat(raw.isDeleted()).isTrue();
    }

    @Test
    void should_addPaymentAndUpdateCoveredAmount() {
        var created = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 100000L, Currency.UAH, null, "debt", LocalDate.now()));

        var withPayment = debtRecordService.addPayment(created.id(),
                new AddPaymentRequest(30000L, LocalDate.now(), "first payment"));

        assertThat(withPayment.coveredAmount()).isEqualTo(30000L);
        assertThat(withPayment.remainingAmount()).isEqualTo(70000L);
        assertThat(withPayment.status()).isEqualTo(DebtStatus.OPEN);
        assertThat(withPayment.payments()).hasSize(1);
        assertThat(withPayment.payments().getFirst().amount()).isEqualTo(30000L);
    }

    @Test
    void should_autoCloseWhenFullyCovered() {
        var created = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 100000L, Currency.UAH, null, "debt", LocalDate.now()));

        debtRecordService.addPayment(created.id(),
                new AddPaymentRequest(60000L, LocalDate.now(), "payment 1"));
        var result = debtRecordService.addPayment(created.id(),
                new AddPaymentRequest(40000L, LocalDate.now(), "payment 2"));

        assertThat(result.coveredAmount()).isEqualTo(100000L);
        assertThat(result.remainingAmount()).isEqualTo(0);
        assertThat(result.status()).isEqualTo(DebtStatus.CLOSED);
    }

    @Test
    void should_removePaymentAndRecalculate() {
        var created = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 100000L, Currency.UAH, null, "debt", LocalDate.now()));

        var withPayment1 = debtRecordService.addPayment(created.id(),
                new AddPaymentRequest(30000L, LocalDate.now(), "payment 1"));
        var withPayment2 = debtRecordService.addPayment(created.id(),
                new AddPaymentRequest(20000L, LocalDate.now(), "payment 2"));

        assertThat(withPayment2.coveredAmount()).isEqualTo(50000L);

        var paymentIdToRemove = withPayment2.payments().getFirst().id();
        var afterRemoval = debtRecordService.removePayment(created.id(), paymentIdToRemove);

        assertThat(afterRemoval.coveredAmount()).isEqualTo(20000L);
        assertThat(afterRemoval.payments()).hasSize(1);
    }

    @Test
    void should_rejectPaymentExceedingRemaining() {
        var created = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 100000L, Currency.UAH, null, "debt", LocalDate.now()));

        debtRecordService.addPayment(created.id(),
                new AddPaymentRequest(80000L, LocalDate.now(), "big payment"));

        assertThatThrownBy(() -> debtRecordService.addPayment(created.id(),
                new AddPaymentRequest(30000L, LocalDate.now(), "too much")))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("exceeds remaining");
    }

    @Test
    void should_toggleStatus() {
        var created = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 100000L, Currency.UAH, null, "debt", LocalDate.now()));

        assertThat(created.status()).isEqualTo(DebtStatus.OPEN);

        var toggled = debtRecordService.toggleStatus(created.id());
        assertThat(toggled.status()).isEqualTo(DebtStatus.CLOSED);

        var toggledBack = debtRecordService.toggleStatus(created.id());
        assertThat(toggledBack.status()).isEqualTo(DebtStatus.OPEN);
    }

    @Test
    void should_returnCorrectSummary_when_sameCurrency() {
        // Alice: DEBT 100000 UAH, 20000 covered = 80000 remaining
        var debt1 = debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 100000L, Currency.UAH, null, "debt to alice", LocalDate.now()));
        debtRecordService.addPayment(debt1.id(),
                new AddPaymentRequest(20000L, LocalDate.now(), "partial"));

        // Alice: LOAN 50000 UAH, 0 covered = 50000 remaining
        debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.LOAN, 50000L, Currency.UAH, null, "loan to alice", LocalDate.now()));

        var summary = debtRecordService.getSummary();

        assertThat(summary.displayCurrency()).isEqualTo(Currency.UAH);
        assertThat(summary.entries()).hasSize(1);

        var aliceSummary = summary.entries().getFirst();
        assertThat(aliceSummary.personName()).isEqualTo("Alice");
        assertThat(aliceSummary.totalDebt()).isEqualTo(80000L);
        assertThat(aliceSummary.totalLoan()).isEqualTo(50000L);
        assertThat(aliceSummary.net()).isEqualTo(-30000L);
    }

    @Test
    void should_groupByPersonOnly_when_multiplePersons() {
        var person2 = personService.create(new CreatePersonRequest("Bob"));

        // Alice: DEBT 100000 UAH
        debtRecordService.create(new CreateDebtRecordRequest(
                personId, DebtType.DEBT, 100000L, Currency.UAH, null, "debt to alice", LocalDate.now()));

        // Bob: DEBT 30000 UAH
        debtRecordService.create(new CreateDebtRecordRequest(
                person2.getId(), DebtType.DEBT, 30000L, Currency.UAH, null, "debt to bob", LocalDate.now()));

        var summary = debtRecordService.getSummary();

        assertThat(summary.displayCurrency()).isEqualTo(Currency.UAH);
        assertThat(summary.entries()).hasSize(2);

        var aliceSummary = summary.entries().stream()
                .filter(s -> s.personId().equals(personId))
                .findFirst().orElseThrow();
        assertThat(aliceSummary.personName()).isEqualTo("Alice");
        assertThat(aliceSummary.totalDebt()).isEqualTo(100000L);

        var bobSummary = summary.entries().stream()
                .filter(s -> s.personId().equals(person2.getId()))
                .findFirst().orElseThrow();
        assertThat(bobSummary.personName()).isEqualTo("Bob");
        assertThat(bobSummary.totalDebt()).isEqualTo(30000L);
    }
}
