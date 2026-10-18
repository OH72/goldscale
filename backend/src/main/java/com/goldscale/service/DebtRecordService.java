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
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
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
    private final TagService tagService;

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

        var query = Query.query(criteria)
                .with(Sort.by(Sort.Order.desc("date"), Sort.Order.desc("createdAt")));
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
        record.setTagIds(normalizeTagIds(request.tagIds()));
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
        record.setTagIds(normalizeTagIds(request.tagIds()));
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

        record = applyPayment(record, request.amount(), request.date(), request.description());

        return enrichWithNames(List.of(record)).getFirst();
    }

    /** Adds an offset payment with a group ID linking all payments from the same offset operation. */
    DebtRecord applyOffsetPayment(DebtRecord record, long amount, LocalDate date,
                                  String description, String offsetGroupId) {
        var payment = new Payment();
        payment.setId(UUID.randomUUID().toString());
        payment.setAmount(amount);
        payment.setDate(date);
        payment.setDescription(description);
        payment.setOffsetGroupId(offsetGroupId);
        payment.setCreatedAt(Instant.now());

        record.getPayments().add(payment);
        record.setCoveredAmount(record.getCoveredAmount() + amount);

        if (record.getCoveredAmount() >= record.getAmount()) {
            record.setStatus(DebtStatus.CLOSED);
        }

        record.setUpdatedAt(Instant.now());
        return debtRecordRepository.save(record);
    }

    /** Adds a payment, updates the covered amount and closes the record when fully covered. */
    DebtRecord applyPayment(DebtRecord record, long amount, LocalDate date, String description) {
        var payment = new Payment();
        payment.setId(UUID.randomUUID().toString());
        payment.setAmount(amount);
        payment.setDate(date);
        payment.setDescription(description);
        payment.setCreatedAt(Instant.now());

        record.getPayments().add(payment);
        record.setCoveredAmount(record.getCoveredAmount() + amount);

        if (record.getCoveredAmount() >= record.getAmount()) {
            record.setStatus(DebtStatus.CLOSED);
        }

        record.setUpdatedAt(Instant.now());
        return debtRecordRepository.save(record);
    }

    public DebtRecordResponse removePayment(String id, String paymentId) {
        var record = getActiveRecord(id);

        var payment = record.getPayments().stream()
                .filter(p -> p.getId().equals(paymentId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));

        // If this is an offset payment, cascade-remove all payments in the same group
        if (payment.getOffsetGroupId() != null) {
            removeOffsetGroup(record.getPersonId(), payment.getOffsetGroupId());
            // Re-fetch the record after cascade removal
            record = getActiveRecord(id);
            return enrichWithNames(List.of(record)).getFirst();
        }

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

    /** Removes all payments with the given offsetGroupId across all records for the person. */
    void removeOffsetGroup(String personId, String offsetGroupId) {
        var records = debtRecordRepository.findByPersonIdAndDeletedFalse(personId);
        for (var record : records) {
            boolean removed = record.getPayments()
                    .removeIf(p -> offsetGroupId.equals(p.getOffsetGroupId()));
            if (removed) {
                long newCovered = record.getPayments().stream()
                        .mapToLong(Payment::getAmount)
                        .sum();
                record.setCoveredAmount(newCovered);
                record.setStatus(newCovered >= record.getAmount() ? DebtStatus.CLOSED : DebtStatus.OPEN);
                record.setUpdatedAt(Instant.now());
                debtRecordRepository.save(record);
            }
        }
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
        var summaries = new ArrayList<>(getSummaryByPerson().values());
        return new DebtSummaryResponse(displayCurrency, summaries);
    }

    /** Open debt/loan totals per person, converted to the display currency. */
    public Map<String, DebtSummaryEntry> getSummaryByPerson() {
        var displayCurrency = settingsService.get().getDisplayCurrency();
        var rates = exchangeRateService.getLatestRates();

        var records = debtRecordRepository.findByDeletedFalse().stream()
                .filter(r -> r.getStatus() == DebtStatus.OPEN)
                .toList();

        var personIds = records.stream()
                .map(DebtRecord::getPersonId)
                .collect(Collectors.toSet());

        var personNames = personRepository.findAllById(personIds).stream()
                .collect(Collectors.toMap(Person::getId, Person::getName));

        var grouped = records.stream()
                .collect(Collectors.groupingBy(DebtRecord::getPersonId));

        var summaries = new LinkedHashMap<String, DebtSummaryEntry>();

        for (var entry : grouped.entrySet()) {
            var personId = entry.getKey();

            long totalDebt = 0;
            long totalLoan = 0;

            for (var record : entry.getValue()) {
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

            summaries.put(personId, new DebtSummaryEntry(
                    personId,
                    personNames.getOrDefault(personId, "Unknown"),
                    totalDebt,
                    totalLoan,
                    totalLoan - totalDebt
            ));
        }

        return summaries;
    }

    // --- Transaction-linked operations ---

    /**
     * Creates a payment on a debt record originating from a transaction.
     * Returns the created Payment (caller stores the payment ID on the transaction).
     */
    Payment applyPaymentFromTransaction(String recordId, long amount, LocalDate date,
                                        String description, String transactionId) {
        var record = getActiveRecord(recordId);

        long remaining = record.getAmount() - record.getCoveredAmount();
        if (amount > remaining) {
            throw new BusinessRuleException(
                    "Payment amount (" + amount + ") exceeds remaining amount (" + remaining + ")");
        }

        var payment = new Payment();
        payment.setId(UUID.randomUUID().toString());
        payment.setAmount(amount);
        payment.setDate(date);
        payment.setDescription(description);
        payment.setTransactionId(transactionId);
        payment.setCreatedAt(Instant.now());

        record.getPayments().add(payment);
        record.setCoveredAmount(record.getCoveredAmount() + amount);

        if (record.getCoveredAmount() >= record.getAmount()) {
            record.setStatus(DebtStatus.CLOSED);
        }

        record.setUpdatedAt(Instant.now());
        debtRecordRepository.save(record);

        return payment;
    }

    /**
     * Updates an existing payment that was created from a transaction.
     * Recalculates coveredAmount and status.
     */
    void updatePaymentFromTransaction(String recordId, String paymentId,
                                      long newAmount, LocalDate newDate, String newDescription) {
        var record = getActiveRecord(recordId);

        var payment = record.getPayments().stream()
                .filter(p -> p.getId().equals(paymentId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));

        long otherPaymentsTotal = record.getPayments().stream()
                .filter(p -> !p.getId().equals(paymentId))
                .mapToLong(Payment::getAmount)
                .sum();

        long remaining = record.getAmount() - otherPaymentsTotal;
        if (newAmount > remaining) {
            throw new BusinessRuleException(
                    "Updated payment amount (" + newAmount + ") exceeds remaining amount (" + remaining + ")");
        }

        payment.setAmount(newAmount);
        payment.setDate(newDate);
        payment.setDescription(newDescription);

        record.setCoveredAmount(otherPaymentsTotal + newAmount);
        record.setStatus(record.getCoveredAmount() >= record.getAmount() ? DebtStatus.CLOSED : DebtStatus.OPEN);
        record.setUpdatedAt(Instant.now());
        debtRecordRepository.save(record);
    }

    /**
     * Removes a payment by its linked transaction ID.
     * Recalculates coveredAmount and status.
     */
    void removePaymentByTransactionId(String recordId, String transactionId) {
        var record = getActiveRecord(recordId);

        var payment = record.getPayments().stream()
                .filter(p -> transactionId.equals(p.getTransactionId()))
                .findFirst()
                .orElse(null);

        if (payment == null) return;

        record.getPayments().remove(payment);
        long newCovered = record.getPayments().stream()
                .mapToLong(Payment::getAmount)
                .sum();
        record.setCoveredAmount(newCovered);

        if (record.getCoveredAmount() < record.getAmount()) {
            record.setStatus(DebtStatus.OPEN);
        }

        record.setUpdatedAt(Instant.now());
        debtRecordRepository.save(record);
    }

    /**
     * Updates the debt record amount when the originating transaction (UC2/UC3) is edited.
     */
    void updateDebtAmountFromTransaction(String recordId, long newAmount) {
        var record = getActiveRecord(recordId);

        if (newAmount < record.getCoveredAmount()) {
            throw new BusinessRuleException(
                    "New amount cannot be less than covered amount (" + record.getCoveredAmount() + ")");
        }

        record.setAmount(newAmount);
        record.setStatus(record.getCoveredAmount() >= record.getAmount() ? DebtStatus.CLOSED : DebtStatus.OPEN);
        record.setUpdatedAt(Instant.now());
        debtRecordRepository.save(record);
    }

    /**
     * Soft-deletes a debt record only if it has no payments.
     * Throws BusinessRuleException if payments exist.
     */
    void softDeleteIfNoPayments(String recordId) {
        var record = getActiveRecord(recordId);

        if (record.getPayments() != null && !record.getPayments().isEmpty()) {
            throw new BusinessRuleException(
                    "Cannot delete: linked debt record has existing payments. Remove them first.");
        }

        record.setDeleted(true);
        record.setUpdatedAt(Instant.now());
        debtRecordRepository.save(record);
    }

    /**
     * Creates a new debt record from a transaction (UC2/UC3).
     * Returns the created DebtRecord.
     */
    DebtRecord createFromTransaction(String personId, DebtType type, long amount,
                                     com.goldscale.model.Currency currency, LocalDate date,
                                     String description, String categoryId, List<String> tagIds,
                                     String sourceTransactionId) {
        validatePersonExists(personId);

        var record = new DebtRecord();
        record.setPersonId(personId);
        record.setType(type);
        record.setAmount(amount);
        record.setCoveredAmount(0);
        record.setCurrency(currency);
        record.setCategoryId(categoryId);
        record.setTagIds(tagIds != null ? new ArrayList<>(tagIds) : new ArrayList<>());
        record.setDate(date);
        record.setDescription(description);
        record.setStatus(DebtStatus.OPEN);
        record.setPayments(new ArrayList<>());
        record.setSourceTransactionId(sourceTransactionId);
        record.setDeleted(false);
        record.setUpdatedAt(Instant.now());
        return debtRecordRepository.save(record);
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

    private static List<String> normalizeTagIds(List<String> tagIds) {
        return tagIds == null ? new ArrayList<>() : tagIds.stream().distinct().collect(Collectors.toCollection(ArrayList::new));
    }

    private List<DebtRecordResponse> enrichWithNames(List<DebtRecord> records) {
        var personIds = new HashSet<String>();
        var categoryIds = new HashSet<String>();
        var tagIds = new HashSet<String>();

        for (var record : records) {
            personIds.add(record.getPersonId());
            if (record.getTagIds() != null) {
                tagIds.addAll(record.getTagIds());
            }
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

        var tagNames = tagService.getTagNamesByIds(new ArrayList<>(tagIds));

        return records.stream()
                .map(record -> DebtRecordResponse.from(
                        record,
                        personNames.getOrDefault(record.getPersonId(), "Unknown"),
                        record.getCategoryId() != null
                                ? categoryNames.getOrDefault(record.getCategoryId(), null)
                                : null,
                        tagNames
                ))
                .toList();
    }
}
