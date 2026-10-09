package com.goldscale.service;

import com.goldscale.dto.request.AddPaymentRequest;
import com.goldscale.dto.request.CreateDebtRecordRequest;
import com.goldscale.dto.request.UpdateDebtRecordRequest;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.*;
import com.goldscale.model.Currency;
import com.goldscale.repository.CategoryRepository;
import com.goldscale.repository.DebtRecordRepository;
import com.goldscale.repository.PersonRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DebtRecordServiceTest {

    @Mock private DebtRecordRepository debtRecordRepository;
    @Mock private PersonRepository personRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private MongoTemplate mongoTemplate;
    @Mock private ExchangeRateService exchangeRateService;
    @Mock private SettingsService settingsService;
    @Mock private TagService tagService;

    @InjectMocks private DebtRecordService debtRecordService;

    @Test
    void should_createRecord_when_validRequest() {
        var request = new CreateDebtRecordRequest(
                "p1", DebtType.DEBT, 100000L, Currency.UAH, null, "test", LocalDate.now());

        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        when(personRepository.existsById("p1")).thenReturn(true);
        when(personRepository.findAllById(any())).thenReturn(List.of(person));
        when(debtRecordRepository.save(any())).thenAnswer(inv -> {
            var record = (DebtRecord) inv.getArgument(0);
            record.setId("dr1");
            record.setCreatedAt(Instant.now());
            return record;
        });

        var result = debtRecordService.create(request);

        assertThat(result.amount()).isEqualTo(100000L);
        assertThat(result.status()).isEqualTo(DebtStatus.OPEN);
        assertThat(result.coveredAmount()).isEqualTo(0);
        verify(debtRecordRepository).save(any());
    }

    @Test
    void should_saveTagsAndReturnTagNames_when_createWithTags() {
        var request = new CreateDebtRecordRequest(
                "p1", DebtType.LOAN, 5000L, Currency.USD, null,
                java.util.Arrays.asList("t1", "t2", "t1"), "test", LocalDate.now());

        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        when(personRepository.existsById("p1")).thenReturn(true);
        when(personRepository.findAllById(any())).thenReturn(List.of(person));
        when(tagService.getTagNamesByIds(any())).thenReturn(java.util.Map.of("t1", "Food", "t2", "Trip"));
        when(debtRecordRepository.save(any())).thenAnswer(inv -> {
            var record = (DebtRecord) inv.getArgument(0);
            record.setId("dr1");
            record.setCreatedAt(Instant.now());
            return record;
        });

        var result = debtRecordService.create(request);

        assertThat(result.tagIds()).containsExactly("t1", "t2");
        assertThat(result.tagNames()).containsExactly("Food", "Trip");
    }

    @Test
    void should_throwNotFound_when_personNotExists() {
        var request = new CreateDebtRecordRequest(
                "missing", DebtType.DEBT, 100000L, Currency.UAH, null, "test", LocalDate.now());

        when(personRepository.existsById("missing")).thenReturn(false);

        assertThatThrownBy(() -> debtRecordService.create(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Person");
    }

    @Test
    void should_throwNotFound_when_categoryNotExists() {
        var request = new CreateDebtRecordRequest(
                "p1", DebtType.DEBT, 100000L, Currency.UAH, "cat-missing", "test", LocalDate.now());

        when(personRepository.existsById("p1")).thenReturn(true);
        when(categoryRepository.existsById("cat-missing")).thenReturn(false);

        assertThatThrownBy(() -> debtRecordService.create(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Category");
    }

    @Test
    void should_updateRecord_when_validRequest() {
        var record = createTestRecord("dr1", "p1", 100000L, 0);
        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        when(debtRecordRepository.findByIdAndDeletedFalse("dr1")).thenReturn(Optional.of(record));
        when(personRepository.findAllById(any())).thenReturn(List.of(person));
        when(debtRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var request = new UpdateDebtRecordRequest(
                null, null, 200000L, Currency.UAH, null, "updated", LocalDate.now());

        var result = debtRecordService.update("dr1", request);

        assertThat(result.amount()).isEqualTo(200000L);
        assertThat(result.description()).isEqualTo("updated");
    }

    @Test
    void should_throwBusinessRule_when_amountBelowCovered() {
        var record = createTestRecord("dr1", "p1", 100000L, 50000);
        when(debtRecordRepository.findByIdAndDeletedFalse("dr1")).thenReturn(Optional.of(record));

        var request = new UpdateDebtRecordRequest(
                null, null, 30000L, Currency.UAH, null, "test", LocalDate.now());

        assertThatThrownBy(() -> debtRecordService.update("dr1", request))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("covered amount");
    }

    @Test
    void should_softDelete_when_delete() {
        var record = createTestRecord("dr1", "p1", 100000L, 0);
        when(debtRecordRepository.findByIdAndDeletedFalse("dr1")).thenReturn(Optional.of(record));
        when(debtRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        debtRecordService.delete("dr1");

        assertThat(record.isDeleted()).isTrue();
        verify(debtRecordRepository).save(record);
    }

    @Test
    void should_addPayment_when_validAmount() {
        var record = createTestRecord("dr1", "p1", 100000L, 0);
        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        when(debtRecordRepository.findByIdAndDeletedFalse("dr1")).thenReturn(Optional.of(record));
        when(personRepository.findAllById(any())).thenReturn(List.of(person));
        when(debtRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var request = new AddPaymentRequest(30000L, LocalDate.now(), "partial");

        var result = debtRecordService.addPayment("dr1", request);

        assertThat(result.coveredAmount()).isEqualTo(30000L);
        assertThat(result.remainingAmount()).isEqualTo(70000L);
        assertThat(result.status()).isEqualTo(DebtStatus.OPEN);
        assertThat(result.payments()).hasSize(1);
    }

    @Test
    void should_throwBusinessRule_when_paymentExceedsRemaining() {
        var record = createTestRecord("dr1", "p1", 100000L, 80000);
        when(debtRecordRepository.findByIdAndDeletedFalse("dr1")).thenReturn(Optional.of(record));

        var request = new AddPaymentRequest(30000L, LocalDate.now(), "too much");

        assertThatThrownBy(() -> debtRecordService.addPayment("dr1", request))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("exceeds remaining");
    }

    @Test
    void should_autoCloseRecord_when_fullyCovered() {
        var record = createTestRecord("dr1", "p1", 100000L, 70000);
        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        when(debtRecordRepository.findByIdAndDeletedFalse("dr1")).thenReturn(Optional.of(record));
        when(personRepository.findAllById(any())).thenReturn(List.of(person));
        when(debtRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var request = new AddPaymentRequest(30000L, LocalDate.now(), "final");

        var result = debtRecordService.addPayment("dr1", request);

        assertThat(result.coveredAmount()).isEqualTo(100000L);
        assertThat(result.status()).isEqualTo(DebtStatus.CLOSED);
    }

    @Test
    void should_removePayment_when_exists() {
        var record = createTestRecord("dr1", "p1", 100000L, 30000);
        var payment = new Payment();
        payment.setId("pay1");
        payment.setAmount(30000);
        payment.setDate(LocalDate.now());
        payment.setCreatedAt(Instant.now());
        record.setPayments(new ArrayList<>(List.of(payment)));

        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        when(debtRecordRepository.findByIdAndDeletedFalse("dr1")).thenReturn(Optional.of(record));
        when(personRepository.findAllById(any())).thenReturn(List.of(person));
        when(debtRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = debtRecordService.removePayment("dr1", "pay1");

        assertThat(result.coveredAmount()).isEqualTo(0);
        assertThat(result.payments()).isEmpty();
    }

    @Test
    void should_reopenRecord_when_paymentRemoved() {
        var record = createTestRecord("dr1", "p1", 100000L, 100000);
        record.setStatus(DebtStatus.CLOSED);
        var payment = new Payment();
        payment.setId("pay1");
        payment.setAmount(50000);
        payment.setDate(LocalDate.now());
        payment.setCreatedAt(Instant.now());
        var payment2 = new Payment();
        payment2.setId("pay2");
        payment2.setAmount(50000);
        payment2.setDate(LocalDate.now());
        payment2.setCreatedAt(Instant.now());
        record.setPayments(new ArrayList<>(List.of(payment, payment2)));

        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        when(debtRecordRepository.findByIdAndDeletedFalse("dr1")).thenReturn(Optional.of(record));
        when(personRepository.findAllById(any())).thenReturn(List.of(person));
        when(debtRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = debtRecordService.removePayment("dr1", "pay1");

        assertThat(result.coveredAmount()).isEqualTo(50000L);
        assertThat(result.status()).isEqualTo(DebtStatus.OPEN);
    }

    @Test
    void should_toggleStatus_when_called() {
        var record = createTestRecord("dr1", "p1", 100000L, 0);
        record.setStatus(DebtStatus.OPEN);

        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        when(debtRecordRepository.findByIdAndDeletedFalse("dr1")).thenReturn(Optional.of(record));
        when(personRepository.findAllById(any())).thenReturn(List.of(person));
        when(debtRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = debtRecordService.toggleStatus("dr1");

        assertThat(result.status()).isEqualTo(DebtStatus.CLOSED);
    }

    @Test
    void should_returnSummary_when_sameCurrency() {
        var record1 = createTestRecord("dr1", "p1", 100000L, 20000);
        record1.setType(DebtType.DEBT);
        record1.setCurrency(Currency.UAH);
        record1.setStatus(DebtStatus.OPEN);

        var record2 = createTestRecord("dr2", "p1", 50000L, 0);
        record2.setType(DebtType.LOAN);
        record2.setCurrency(Currency.UAH);
        record2.setStatus(DebtStatus.OPEN);

        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        var settings = new Settings();
        settings.setDisplayCurrency(Currency.UAH);

        when(settingsService.get()).thenReturn(settings);
        when(exchangeRateService.getLatestRates()).thenReturn(Map.of());
        when(exchangeRateService.convertWithRates(eq(80000L), eq(Currency.UAH), eq(Currency.UAH), any()))
                .thenReturn(OptionalLong.of(80000L));
        when(exchangeRateService.convertWithRates(eq(50000L), eq(Currency.UAH), eq(Currency.UAH), any()))
                .thenReturn(OptionalLong.of(50000L));
        when(debtRecordRepository.findByDeletedFalse()).thenReturn(List.of(record1, record2));
        when(personRepository.findAllById(any())).thenReturn(List.of(person));

        var result = debtRecordService.getSummary();

        assertThat(result.displayCurrency()).isEqualTo(Currency.UAH);
        assertThat(result.entries()).hasSize(1);
        var entry = result.entries().getFirst();
        assertThat(entry.personName()).isEqualTo("Alice");
        assertThat(entry.totalDebt()).isEqualTo(80000L);  // 100000 - 20000
        assertThat(entry.totalLoan()).isEqualTo(50000L);
        assertThat(entry.net()).isEqualTo(-30000L);  // 50000 - 80000
    }

    @Test
    void should_convertCurrencies_when_mixedCurrencyDebts() {
        var record1 = createTestRecord("dr1", "p1", 100000L, 0);
        record1.setType(DebtType.DEBT);
        record1.setCurrency(Currency.UAH);
        record1.setStatus(DebtStatus.OPEN);

        var record2 = createTestRecord("dr2", "p1", 50000L, 0);
        record2.setType(DebtType.LOAN);
        record2.setCurrency(Currency.USD);
        record2.setStatus(DebtStatus.OPEN);

        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        var settings = new Settings();
        settings.setDisplayCurrency(Currency.UAH);

        var rates = Map.of("UAH", 24390L, "USD", 1000000L); // ~41 UAH per USD

        when(settingsService.get()).thenReturn(settings);
        when(exchangeRateService.getLatestRates()).thenReturn(rates);
        // UAH->UAH: same amount
        when(exchangeRateService.convertWithRates(eq(100000L), eq(Currency.UAH), eq(Currency.UAH), eq(rates)))
                .thenReturn(OptionalLong.of(100000L));
        // USD->UAH: 50000 * 1000000 / 24390 = 2050020 (roughly 500 USD * 41 = ~20500 UAH in subunits)
        when(exchangeRateService.convertWithRates(eq(50000L), eq(Currency.USD), eq(Currency.UAH), eq(rates)))
                .thenReturn(OptionalLong.of(2050020L));
        when(debtRecordRepository.findByDeletedFalse()).thenReturn(List.of(record1, record2));
        when(personRepository.findAllById(any())).thenReturn(List.of(person));

        var result = debtRecordService.getSummary();

        assertThat(result.displayCurrency()).isEqualTo(Currency.UAH);
        assertThat(result.entries()).hasSize(1);
        var entry = result.entries().getFirst();
        assertThat(entry.personId()).isEqualTo("p1");
        assertThat(entry.totalDebt()).isEqualTo(100000L);
        assertThat(entry.totalLoan()).isEqualTo(2050020L);
        assertThat(entry.net()).isEqualTo(2050020L - 100000L);
    }

    @Test
    void should_skipAmount_when_conversionFails() {
        var record1 = createTestRecord("dr1", "p1", 100000L, 0);
        record1.setType(DebtType.DEBT);
        record1.setCurrency(Currency.USD);
        record1.setStatus(DebtStatus.OPEN);

        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        var settings = new Settings();
        settings.setDisplayCurrency(Currency.UAH);

        when(settingsService.get()).thenReturn(settings);
        when(exchangeRateService.getLatestRates()).thenReturn(Map.of());
        when(exchangeRateService.convertWithRates(eq(100000L), eq(Currency.USD), eq(Currency.UAH), any()))
                .thenReturn(OptionalLong.empty());
        when(debtRecordRepository.findByDeletedFalse()).thenReturn(List.of(record1));
        when(personRepository.findAllById(any())).thenReturn(List.of(person));

        var result = debtRecordService.getSummary();

        assertThat(result.entries()).hasSize(1);
        var entry = result.entries().getFirst();
        assertThat(entry.totalDebt()).isEqualTo(0);
        assertThat(entry.totalLoan()).isEqualTo(0);
        assertThat(entry.net()).isEqualTo(0);
    }

    // --- Helpers ---

    private DebtRecord createTestRecord(String id, String personId, long amount, long coveredAmount) {
        var record = new DebtRecord();
        record.setId(id);
        record.setPersonId(personId);
        record.setType(DebtType.DEBT);
        record.setAmount(amount);
        record.setCoveredAmount(coveredAmount);
        record.setCurrency(Currency.UAH);
        record.setDate(LocalDate.now());
        record.setStatus(DebtStatus.OPEN);
        record.setPayments(new ArrayList<>());
        record.setDeleted(false);
        record.setCreatedAt(Instant.now());
        record.setUpdatedAt(Instant.now());
        return record;
    }
}
