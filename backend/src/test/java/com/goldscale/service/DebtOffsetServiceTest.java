package com.goldscale.service;

import com.goldscale.exception.BusinessRuleException;
import com.goldscale.model.Currency;
import com.goldscale.model.DebtRecord;
import com.goldscale.model.DebtStatus;
import com.goldscale.model.DebtType;
import com.goldscale.model.Person;
import com.goldscale.repository.DebtRecordRepository;
import com.goldscale.repository.PersonRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DebtOffsetServiceTest {

    @Mock private DebtRecordRepository debtRecordRepository;
    @Mock private PersonRepository personRepository;
    @Mock private DebtRecordService debtRecordService;

    @InjectMocks private DebtOffsetService debtOffsetService;

    private Person person() {
        var person = new Person();
        person.setId("p1");
        person.setName("Alice");
        return person;
    }

    private DebtRecord record(String id, DebtType type, long amount, long covered, Currency currency, LocalDate date) {
        var r = new DebtRecord();
        r.setId(id);
        r.setPersonId("p1");
        r.setType(type);
        r.setAmount(amount);
        r.setCoveredAmount(covered);
        r.setCurrency(currency);
        r.setDate(date);
        r.setStatus(DebtStatus.OPEN);
        r.setPayments(new ArrayList<>());
        r.setCreatedAt(Instant.now());
        return r;
    }

    @Test
    void should_coverSmallerSideAndReduceLargerSide_oldestFirst() {
        var d1 = record("d1", DebtType.DEBT, 10000, 0, Currency.UAH, LocalDate.of(2026, 1, 1));
        var d2 = record("d2", DebtType.DEBT, 5000, 0, Currency.UAH, LocalDate.of(2026, 2, 1));
        var l1 = record("l1", DebtType.LOAN, 12000, 0, Currency.UAH, LocalDate.of(2026, 1, 15));

        when(personRepository.findById("p1")).thenReturn(Optional.of(person()));
        when(debtRecordRepository.findByPersonIdAndDeletedFalse("p1")).thenReturn(List.of(d2, l1, d1));

        var result = debtOffsetService.preview("p1");

        assertThat(result.currencies()).hasSize(1);
        var entry = result.currencies().getFirst();
        assertThat(entry.currency()).isEqualTo(Currency.UAH);
        assertThat(entry.amount()).isEqualTo(12000);
        assertThat(entry.loans()).hasSize(1);
        assertThat(entry.loans().getFirst().amount()).isEqualTo(12000);
        assertThat(entry.loans().getFirst().remainingAfter()).isZero();
        assertThat(entry.debts()).extracting("recordId").containsExactly("d1", "d2");
        assertThat(entry.debts().get(0).amount()).isEqualTo(10000);
        assertThat(entry.debts().get(1).amount()).isEqualTo(2000);
        assertThat(entry.debts().get(1).remainingAfter()).isEqualTo(3000);
    }

    @Test
    void should_notOffset_when_currenciesDiffer() {
        var d1 = record("d1", DebtType.DEBT, 10000, 0, Currency.USD, LocalDate.of(2026, 1, 1));
        var l1 = record("l1", DebtType.LOAN, 12000, 0, Currency.EUR, LocalDate.of(2026, 1, 15));

        when(personRepository.findById("p1")).thenReturn(Optional.of(person()));
        when(debtRecordRepository.findByPersonIdAndDeletedFalse("p1")).thenReturn(List.of(d1, l1));

        assertThat(debtOffsetService.preview("p1").currencies()).isEmpty();
    }

    @Test
    void should_ignoreClosedRecords() {
        var d1 = record("d1", DebtType.DEBT, 10000, 0, Currency.UAH, LocalDate.of(2026, 1, 1));
        var l1 = record("l1", DebtType.LOAN, 12000, 12000, Currency.UAH, LocalDate.of(2026, 1, 15));
        l1.setStatus(DebtStatus.CLOSED);

        when(debtRecordRepository.findByDeletedFalse()).thenReturn(List.of(d1, l1));

        assertThat(debtOffsetService.personIdsWithOffset()).isEmpty();
    }

    @Test
    void should_listPersonIds_when_offsetPossible() {
        var d1 = record("d1", DebtType.DEBT, 10000, 0, Currency.UAH, LocalDate.of(2026, 1, 1));
        var l1 = record("l1", DebtType.LOAN, 500, 0, Currency.UAH, LocalDate.of(2026, 1, 15));

        when(debtRecordRepository.findByDeletedFalse()).thenReturn(List.of(d1, l1));

        assertThat(debtOffsetService.personIdsWithOffset()).containsExactly("p1");
    }

    @Test
    void should_applyPaymentsToBothSides_when_execute() {
        var d1 = record("d1", DebtType.DEBT, 10000, 0, Currency.UAH, LocalDate.of(2026, 1, 1));
        var l1 = record("l1", DebtType.LOAN, 4000, 0, Currency.UAH, LocalDate.of(2026, 1, 15));

        when(personRepository.findById("p1")).thenReturn(Optional.of(person()));
        when(debtRecordRepository.findByPersonIdAndDeletedFalse("p1")).thenReturn(List.of(d1, l1));

        var result = debtOffsetService.execute("p1");

        assertThat(result.currencies().getFirst().amount()).isEqualTo(4000);
        verify(debtRecordService).applyPayment(eq(d1), eq(4000L), any(LocalDate.class), any());
        verify(debtRecordService).applyPayment(eq(l1), eq(4000L), any(LocalDate.class), any());
    }

    @Test
    void should_throw_when_executeWithNothingToOffset() {
        var d1 = record("d1", DebtType.DEBT, 10000, 0, Currency.UAH, LocalDate.of(2026, 1, 1));

        when(personRepository.findById("p1")).thenReturn(Optional.of(person()));
        when(debtRecordRepository.findByPersonIdAndDeletedFalse("p1")).thenReturn(List.of(d1));

        assertThatThrownBy(() -> debtOffsetService.execute("p1"))
                .isInstanceOf(BusinessRuleException.class);
        verify(debtRecordService, never()).applyPayment(any(), any(Long.class), any(), any());
    }
}
