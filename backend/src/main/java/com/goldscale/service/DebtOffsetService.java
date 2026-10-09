package com.goldscale.service;

import com.goldscale.dto.response.OffsetAllocation;
import com.goldscale.dto.response.OffsetCurrencyEntry;
import com.goldscale.dto.response.OffsetResponse;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.Currency;
import com.goldscale.model.DebtRecord;
import com.goldscale.model.DebtStatus;
import com.goldscale.model.DebtType;
import com.goldscale.repository.DebtRecordRepository;
import com.goldscale.repository.PersonRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Offsets a person's open debts against their open loans within the same currency:
 * the smaller side is fully covered, the larger side is reduced by the same amount.
 * Allocation goes to the oldest records first.
 */
@Service
@RequiredArgsConstructor
public class DebtOffsetService {

    static final String OFFSET_DESCRIPTION = "Offset against opposite debt/loan";

    private final DebtRecordRepository debtRecordRepository;
    private final PersonRepository personRepository;
    private final DebtRecordService debtRecordService;

    public OffsetResponse preview(String personId) {
        var person = personRepository.findById(personId)
                .orElseThrow(() -> new ResourceNotFoundException("Person", personId));
        var records = openRecords(debtRecordRepository.findByPersonIdAndDeletedFalse(personId));
        return new OffsetResponse(personId, person.getName(), plan(records));
    }

    /** IDs of people that have something to offset. */
    public Set<String> personIdsWithOffset() {
        var byPerson = openRecords(debtRecordRepository.findByDeletedFalse()).stream()
                .collect(Collectors.groupingBy(DebtRecord::getPersonId));
        return byPerson.entrySet().stream()
                .filter(e -> !plan(e.getValue()).isEmpty())
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());
    }

    @Transactional
    public OffsetResponse execute(String personId) {
        var person = personRepository.findById(personId)
                .orElseThrow(() -> new ResourceNotFoundException("Person", personId));
        var records = openRecords(debtRecordRepository.findByPersonIdAndDeletedFalse(personId));
        var currencies = plan(records);
        if (currencies.isEmpty()) {
            throw new BusinessRuleException(
                    "Nothing to offset for '" + person.getName() + "': needs open debts and loans in the same currency");
        }

        var byId = records.stream().collect(Collectors.toMap(DebtRecord::getId, r -> r));
        var today = LocalDate.now();
        for (var entry : currencies) {
            for (var allocation : concat(entry.debts(), entry.loans())) {
                debtRecordService.applyPayment(
                        byId.get(allocation.recordId()), allocation.amount(), today, OFFSET_DESCRIPTION);
            }
        }
        return new OffsetResponse(personId, person.getName(), currencies);
    }

    private static List<OffsetAllocation> concat(List<OffsetAllocation> a, List<OffsetAllocation> b) {
        var all = new ArrayList<>(a);
        all.addAll(b);
        return all;
    }

    private static List<DebtRecord> openRecords(List<DebtRecord> records) {
        return records.stream()
                .filter(r -> !r.isDeleted())
                .filter(r -> r.getStatus() == DebtStatus.OPEN)
                .filter(r -> r.getAmount() - r.getCoveredAmount() > 0)
                .toList();
    }

    private static List<OffsetCurrencyEntry> plan(List<DebtRecord> records) {
        var byCurrency = records.stream()
                .collect(Collectors.groupingBy(DebtRecord::getCurrency, () -> new EnumMap<>(Currency.class), Collectors.toList()));

        var result = new ArrayList<OffsetCurrencyEntry>();
        for (var entry : byCurrency.entrySet()) {
            var debts = sortOldestFirst(entry.getValue(), DebtType.DEBT);
            var loans = sortOldestFirst(entry.getValue(), DebtType.LOAN);
            long total = Math.min(remainingSum(debts), remainingSum(loans));
            if (total <= 0) {
                continue;
            }
            result.add(new OffsetCurrencyEntry(
                    entry.getKey(), total, allocate(debts, total), allocate(loans, total)));
        }
        return result;
    }

    private static List<DebtRecord> sortOldestFirst(List<DebtRecord> records, DebtType type) {
        return records.stream()
                .filter(r -> r.getType() == type)
                .sorted(Comparator.comparing(DebtRecord::getDate, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(DebtRecord::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private static long remainingSum(List<DebtRecord> records) {
        return records.stream().mapToLong(r -> r.getAmount() - r.getCoveredAmount()).sum();
    }

    private static List<OffsetAllocation> allocate(List<DebtRecord> sorted, long total) {
        var allocations = new ArrayList<OffsetAllocation>();
        long left = total;
        for (var record : sorted) {
            if (left <= 0) {
                break;
            }
            long remaining = record.getAmount() - record.getCoveredAmount();
            long take = Math.min(remaining, left);
            allocations.add(new OffsetAllocation(
                    record.getId(), record.getDescription(), record.getDate(),
                    remaining, take, remaining - take));
            left -= take;
        }
        return allocations;
    }
}
