package com.goldscale.service;

import com.goldscale.dto.request.AddPaymentRequest;
import com.goldscale.dto.request.CreateDebtRecordRequest;
import com.goldscale.dto.request.UpdateDebtRecordRequest;
import com.goldscale.dto.response.DebtRecordResponse;
import com.goldscale.dto.response.DebtSummaryEntry;
import com.goldscale.dto.response.DebtSummaryResponse;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.*;
import com.goldscale.repository.CategoryRepository;
import com.goldscale.repository.DebtRecordRepository;
import com.goldscale.repository.PersonRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DebtRecordService {

    private final DebtRecordRepository debtRecordRepository;
    private final PersonRepository personRepository;
    private final CategoryRepository categoryRepository;
    private final MongoTemplate mongoTemplate;
    private final ExchangeRateService exchangeRateService;
    private final SettingsService settingsService;

    public List<DebtRecordResponse> findAll(String personId, DebtType type, DebtStatus status) {
        var criteria = Criteria.where("deleted").ne(true);

        if (personId != null) {
            criteria = criteria.and("personId").is(personId);
        }
        if (type != null) {
            criteria = criteria.and("type").is(type);
        }
        if (status != null) {
            criteria = criteria.and("status").is(status);
        }

        var query = Query.query(criteria);
        var records = mongoTemplate.find(query, DebtRecord.class);
        return enrichWithNames(records);
    }

    public DebtRecordResponse findById(String id) {
        var record = getActiveRecord(id);
        return enrichWithNames(List.of(record)).getFirst();
    }

    public DebtRecordResponse create(CreateDebtRecordRequest request) {
        validatePersonExists(request.personId());
        if (request.categoryId() != null) {
            validateCategoryExists(request.categoryId());
        }

        var record = new DebtRecord();
        record.setPersonId(request.personId());
        record.setType(request.type());
        record.setAmount(request.amount());
        record.setCoveredAmount(0);
        record.setCurrency(request.currency());
        record.setCategoryId(request.categoryId());
        record.setDescription(request.description());
        record.setDate(request.date());
        record.setStatus(DebtStatus.OPEN);
        record.setPayments(new ArrayList<>());
        record.setDeleted(false);
        record.setUpdatedAt(Instant.now());
        record = debtRecordRepository.save(record);

        return enrichWithNames(List.of(record)).getFirst();
    }

    public DebtRecordResponse update(String id, UpdateDebtRecordRequest request) {
        var record = getActiveRecord(id);

        if (request.personId() != null && !request.personId().equals(record.getPersonId())) {
            validatePersonExists(request.personId());
            record.setPersonId(request.personId());
        }
        if (request.categoryId() != null) {
            validateCategoryExists(request.categoryId());
        }

        if (request.amount() < record.getCoveredAmount()) {
            throw new BusinessRuleException(
                    "New amount cannot be less than covered amount (" + record.getCoveredAmount() + ")");
        }

        record.setAmount(request.amount());
        record.setCurrency(request.currency());
        record.setCategoryId(request.categoryId());
        record.setDescription(request.description());
        record.setDate(request.date());
        if (request.type() != null) {
            record.setType(request.type());
        }

        // Recompute status
        record.setStatus(record.getCoveredAmount() >= record.getAmount() ? DebtStatus.CLOSED : DebtStatus.OPEN);
        record.setUpdatedAt(Instant.now());
        record = debtRecordRepository.save(record);

        return enrichWithNames(List.of(record)).getFirst();
    }

    public void delete(String id) {
        var record = getActiveRecord(id);
        record.setDeleted(true);
        record.setUpdatedAt(Instant.now());
        debtRecordRepository.save(record);
    }

    public DebtRecordResponse addPayment(String id, AddPaymentRequest request) {
        var record = getActiveRecord(id);

        long remaining = record.getAmount() - record.getCoveredAmount();
        if (request.amount() > remaining) {
            throw new BusinessRuleException(
                    "Payment amount (" + request.amount() + ") exceeds remaining amount (" + remaining + ")");
        }

        var payment = new Payment();
        payment.setId(UUID.randomUUID().toString());
        payment.setAmount(request.amount());
        payment.setDate(request.date());
        payment.setDescription(request.description());
        payment.setCreatedAt(Instant.now());

        record.getPayments().add(payment);
        record.setCoveredAmount(record.getCoveredAmount() + request.amount());

        if (record.getCoveredAmount() >= record.getAmount()) {
            record.setStatus(DebtStatus.CLOSED);
        }

        record.setUpdatedAt(Instant.now());
        record = debtRecordRepository.save(record);

        return enrichWithNames(List.of(record)).getFirst();
    }

    public DebtRecordResponse removePayment(String id, String paymentId) {
        var record = getActiveRecord(id);

        var payment = record.getPayments().stream()
                .filter(p -> p.getId().equals(paymentId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));

        record.getPayments().remove(payment);

        // Recalculate coveredAmount from remaining payments
        long newCovered = record.getPayments().stream()
                .mapToLong(Payment::getAmount)
                .sum();
        record.setCoveredAmount(newCovered);

        if (record.getCoveredAmount() < record.getAmount()) {
            record.setStatus(DebtStatus.OPEN);
        }

        record.setUpdatedAt(Instant.now());
        record = debtRecordRepository.save(record);

        return enrichWithNames(List.of(record)).getFirst();
    }

    public DebtRecordResponse toggleStatus(String id) {
        var record = getActiveRecord(id);

        record.setStatus(record.getStatus() == DebtStatus.OPEN ? DebtStatus.CLOSED : DebtStatus.OPEN);
        record.setUpdatedAt(Instant.now());
        record = debtRecordRepository.save(record);

        return enrichWithNames(List.of(record)).getFirst();
    }

    public DebtSummaryResponse getSummary() {
        var displayCurrency = settingsService.get().getDisplayCurrency();
        var rates = exchangeRateService.getLatestRates();

        var records = debtRecordRepository.findByDeletedFalse().stream()
                .filter(r -> r.getStatus() == DebtStatus.OPEN)
                .toList();

        // Collect all person IDs for batch lookup
        var personIds = records.stream()
                .map(DebtRecord::getPersonId)
                .collect(Collectors.toSet());

        var personNames = personRepository.findAllById(personIds).stream()
                .collect(Collectors.toMap(Person::getId, Person::getName));

        // Group by personId only (amounts converted to display currency)
        var grouped = records.stream()
                .collect(Collectors.groupingBy(DebtRecord::getPersonId));

        var summaries = new ArrayList<DebtSummaryEntry>();

        for (var entry : grouped.entrySet()) {
            var personId = entry.getKey();
            var group = entry.getValue();

            long totalDebt = 0;
            long totalLoan = 0;

            for (var record : group) {
                long remaining = record.getAmount() - record.getCoveredAmount();
                var converted = exchangeRateService.convertWithRates(
                        remaining, record.getCurrency(), displayCurrency, rates);
                long convertedAmount = converted.orElse(0);

                if (record.getType() == DebtType.DEBT) {
                    totalDebt += convertedAmount;
                } else {
                    totalLoan += convertedAmount;
                }
            }

            summaries.add(new DebtSummaryEntry(
                    personId,
                    personNames.getOrDefault(personId, "Unknown"),
                    totalDebt,
                    totalLoan,
                    totalLoan - totalDebt
            ));
        }

        return new DebtSummaryResponse(displayCurrency, summaries);
    }

    // --- Internal helpers ---

    private DebtRecord getActiveRecord(String id) {
        return debtRecordRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("DebtRecord", id));
    }

    private void validatePersonExists(String personId) {
        if (!personRepository.existsById(personId)) {
            throw new ResourceNotFoundException("Person", personId);
        }
    }

    private void validateCategoryExists(String categoryId) {
        if (!categoryRepository.existsById(categoryId)) {
            throw new ResourceNotFoundException("Category", categoryId);
        }
    }

    private List<DebtRecordResponse> enrichWithNames(List<DebtRecord> records) {
        var personIds = new HashSet<String>();
        var categoryIds = new HashSet<String>();

        for (var record : records) {
            personIds.add(record.getPersonId());
            if (record.getCategoryId() != null) {
                categoryIds.add(record.getCategoryId());
            }
        }

        var personNames = personRepository.findAllById(personIds).stream()
                .collect(Collectors.toMap(Person::getId, Person::getName));

        Map<String, String> categoryNames = categoryIds.isEmpty()
                ? Map.of()
                : categoryRepository.findAllById(categoryIds).stream()
                        .collect(Collectors.toMap(Category::getId, Category::getName));

        return records.stream()
                .map(record -> DebtRecordResponse.from(
                        record,
                        personNames.getOrDefault(record.getPersonId(), "Unknown"),
                        record.getCategoryId() != null
                                ? categoryNames.getOrDefault(record.getCategoryId(), null)
                                : null
                ))
                .toList();
    }
}
