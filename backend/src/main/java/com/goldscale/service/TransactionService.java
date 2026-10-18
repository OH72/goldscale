package com.goldscale.service;

import com.goldscale.dto.request.DebtLinkRequest;
import com.goldscale.dto.request.NewDebtRequest;
import com.goldscale.dto.request.TransactionCommand;
import com.goldscale.dto.request.TransactionCommand.*;
import com.goldscale.dto.request.UpdateTransactionRequest;
import com.goldscale.dto.response.DebtLinkResponse;
import com.goldscale.dto.response.TransactionResponse;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.*;
import com.goldscale.repository.AccountRepository;
import com.goldscale.repository.CategoryRepository;
import com.goldscale.repository.DebtRecordRepository;
import com.goldscale.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final CategoryRepository categoryRepository;
    private final DebtRecordRepository debtRecordRepository;
    private final BalanceService balanceService;
    private final DebtRecordService debtRecordService;
    private final TagService tagService;
    private final MongoTemplate mongoTemplate;

    public Page<TransactionResponse> findAll(
            String accountId, TransactionType type, String categoryId, String tagId,
            LocalDate startDate, LocalDate endDate, String search, Pageable pageable) {

        var criteria = Criteria.where("deleted").ne(true);

        if (accountId != null) {
            criteria = criteria.andOperator(
                    new Criteria().orOperator(
                            Criteria.where("accountId").is(accountId),
                            Criteria.where("targetAccountId").is(accountId)
                    )
            );
        }
        if (type != null) {
            criteria = criteria.and("type").is(type);
        }
        if (categoryId != null) {
            criteria = criteria.and("categoryId").is(categoryId);
        }
        if (tagId != null) {
            criteria = criteria.and("tags").is(tagId);
        }
        if (search != null && !search.isBlank()) {
            criteria = criteria.and("description").regex(search.trim(), "i");
        }
        if (startDate != null && endDate != null) {
            criteria = criteria.and("date").gte(startDate).lte(endDate);
        } else if (startDate != null) {
            criteria = criteria.and("date").gte(startDate);
        } else if (endDate != null) {
            criteria = criteria.and("date").lte(endDate);
        }

        long total = mongoTemplate.count(Query.query(criteria), Transaction.class);

        var query = Query.query(criteria).with(pageable);
        if (pageable.getSort().isUnsorted()) {
            query.with(org.springframework.data.domain.Sort.by(
                    org.springframework.data.domain.Sort.Direction.DESC, "date", "createdAt"));
        }

        var transactions = mongoTemplate.find(query, Transaction.class);
        var responses = enrichWithNames(transactions);

        return new PageImpl<>(responses, pageable, total);
    }

    public TransactionResponse findById(String id) {
        var txn = getActiveTransaction(id);
        return enrichWithNames(List.of(txn)).getFirst();
    }

    @Transactional
    public TransactionResponse create(TransactionCommand command) {
        var txn = switch (command) {
            case CreateIncome cmd -> createIncomeOrExpense(
                    cmd.accountId(), cmd.amount(), cmd.categoryId(),
                    cmd.date(), cmd.description(), TransactionType.INCOME, cmd.tagIds(),
                    cmd.debtLinks(), cmd.newDebts());
            case CreateExpense cmd -> createIncomeOrExpense(
                    cmd.accountId(), cmd.amount(), cmd.categoryId(),
                    cmd.date(), cmd.description(), TransactionType.EXPENSE, cmd.tagIds(),
                    cmd.debtLinks(), cmd.newDebts());
            case CreateTransfer cmd -> createTransfer(
                    cmd.sourceAccountId(), cmd.targetAccountId(),
                    cmd.amount(), cmd.targetAmount(),
                    cmd.date(), cmd.description(), cmd.tagIds());
        };

        return enrichWithNames(List.of(txn)).getFirst();
    }

    @Transactional
    public TransactionResponse update(String id, UpdateTransactionRequest request) {
        var txn = getActiveTransaction(id);

        return switch (txn.getType()) {
            case INITIAL_BALANCE -> updateInitialBalance(txn, request);
            case INCOME, EXPENSE -> updateIncomeOrExpense(txn, request);
            case TRANSFER -> updateTransfer(txn, request);
        };
    }

    @Transactional
    public void delete(String id) {
        var txn = getActiveTransaction(id);

        if (txn.getType() == TransactionType.INITIAL_BALANCE) {
            throw new BusinessRuleException("Cannot delete INITIAL_BALANCE transaction");
        }

        txn.setDeleted(true);
        transactionRepository.save(txn);

        switch (txn.getType()) {
            case INCOME -> balanceService.adjustBalance(txn.getAccountId(), -txn.getAmount());
            case EXPENSE -> balanceService.adjustBalance(txn.getAccountId(), txn.getAmount());
            case TRANSFER -> {
                balanceService.adjustBalance(txn.getAccountId(), txn.getAmount());
                balanceService.adjustBalance(txn.getTargetAccountId(), -txn.getTargetAmount());
            }
            default -> {}
        }

        // Delete cascade: remove linked payments or soft-delete debt records
        if (txn.getDebtLinks() != null) {
            for (var link : txn.getDebtLinks()) {
                if (link.getPaymentId() != null) {
                    // UC1: remove the payment from the debt record
                    debtRecordService.removePaymentByTransactionId(link.getDebtRecordId(), txn.getId());
                } else {
                    // UC2/UC3: soft-delete the debt record if it has no payments
                    debtRecordService.softDeleteIfNoPayments(link.getDebtRecordId());
                }
            }
        }
    }

    // --- Internal helpers ---

    Transaction createIncomeOrExpense(
            String accountId, long amount, String categoryId,
            LocalDate date, String description, TransactionType type) {
        return createIncomeOrExpense(accountId, amount, categoryId, date, description, type, null, null, null);
    }

    Transaction createIncomeOrExpense(
            String accountId, long amount, String categoryId,
            LocalDate date, String description, TransactionType type, List<String> tagIds) {
        return createIncomeOrExpense(accountId, amount, categoryId, date, description, type, tagIds, null, null);
    }

    Transaction createIncomeOrExpense(
            String accountId, long amount, String categoryId,
            LocalDate date, String description, TransactionType type, List<String> tagIds,
            List<DebtLinkRequest> debtLinkRequests, List<NewDebtRequest> newDebtRequests) {

        validateAccountExists(accountId);
        if (categoryId != null) {
            validateCategoryForTransaction(categoryId, type);
        }
        validateDebtLinkingParams(debtLinkRequests, newDebtRequests, amount, type);

        var txn = new Transaction();
        txn.setType(type);
        txn.setAccountId(accountId);
        txn.setAmount(amount);
        txn.setCategoryId(categoryId);
        txn.setDate(date);
        txn.setDescription(description);
        txn.setTags(tagIds);
        txn.setDeleted(false);
        txn = transactionRepository.save(txn);

        long delta = balanceService.calculateDelta(type, amount);
        balanceService.adjustBalance(accountId, delta);

        var links = new ArrayList<DebtLink>();

        // UC1: Link to existing debt records
        if (debtLinkRequests != null && !debtLinkRequests.isEmpty()) {
            var expectedDebtType = type == TransactionType.EXPENSE ? DebtType.DEBT : DebtType.LOAN;

            for (var req : debtLinkRequests) {
                validateDebtRecordForLinking(req.debtRecordId(), expectedDebtType);

                var payment = debtRecordService.applyPaymentFromTransaction(
                        req.debtRecordId(), req.amount(), date, description, txn.getId());

                var link = new DebtLink();
                link.setDebtRecordId(req.debtRecordId());
                link.setPaymentId(payment.getId());
                link.setAmount(req.amount());
                links.add(link);
            }
        }

        // UC2/UC3: Create new debt records from transaction
        if (newDebtRequests != null && !newDebtRequests.isEmpty()) {
            var debtType = type == TransactionType.INCOME ? DebtType.DEBT : DebtType.LOAN;
            var account = accountRepository.findById(accountId)
                    .orElseThrow(() -> new ResourceNotFoundException("Account", accountId));

            for (var req : newDebtRequests) {
                long debtAmount = req.amount() != null ? req.amount() : amount;

                var debtRecord = debtRecordService.createFromTransaction(
                        req.personId(), debtType, debtAmount, account.getCurrency(),
                        date, description, categoryId, tagIds, txn.getId());

                var link = new DebtLink();
                link.setDebtRecordId(debtRecord.getId());
                link.setAmount(debtAmount);
                links.add(link);
            }
        }

        if (!links.isEmpty()) {
            txn.setDebtLinks(links);
            txn = transactionRepository.save(txn);
        }

        return txn;
    }

    Transaction createTransfer(
            String sourceAccountId, String targetAccountId,
            long amount, long targetAmount,
            LocalDate date, String description) {
        return createTransfer(sourceAccountId, targetAccountId, amount, targetAmount, date, description, null);
    }

    Transaction createTransfer(
            String sourceAccountId, String targetAccountId,
            long amount, long targetAmount,
            LocalDate date, String description, List<String> tagIds) {

        validateAccountExists(sourceAccountId);
        validateAccountExists(targetAccountId);

        if (sourceAccountId.equals(targetAccountId)) {
            throw new BusinessRuleException("Source and target accounts must be different");
        }

        double exchangeRate = (double) targetAmount / amount;

        var txn = new Transaction();
        txn.setType(TransactionType.TRANSFER);
        txn.setAccountId(sourceAccountId);
        txn.setTargetAccountId(targetAccountId);
        txn.setAmount(amount);
        txn.setTargetAmount(targetAmount);
        txn.setExchangeRate(exchangeRate);
        txn.setDate(date);
        txn.setDescription(description);
        txn.setTags(tagIds);
        txn.setDeleted(false);
        txn = transactionRepository.save(txn);

        balanceService.adjustBalance(sourceAccountId, -amount);
        balanceService.adjustBalance(targetAccountId, targetAmount);

        return txn;
    }

    private TransactionResponse updateInitialBalance(Transaction txn, UpdateTransactionRequest request) {
        long oldAmount = txn.getAmount();
        long newAmount = request.amount();
        long delta = newAmount - oldAmount;

        txn.setAmount(newAmount);
        txn.setDate(request.date());
        txn.setDescription(request.description());
        transactionRepository.save(txn);

        if (delta != 0) {
            balanceService.adjustBalance(txn.getAccountId(), delta);
        }

        return enrichWithNames(List.of(txn)).getFirst();
    }

    private TransactionResponse updateIncomeOrExpense(Transaction txn, UpdateTransactionRequest request) {
        if (request.categoryId() != null) {
            validateCategoryForTransaction(request.categoryId(), txn.getType());
        }

        String oldAccountId = txn.getAccountId();
        String newAccountId = request.accountId() != null ? request.accountId() : oldAccountId;
        boolean accountChanged = !newAccountId.equals(oldAccountId);

        if (accountChanged) {
            validateAccountExists(newAccountId);
            // Reverse old balance on old account
            long oldDelta = balanceService.calculateDelta(txn.getType(), txn.getAmount());
            balanceService.adjustBalance(oldAccountId, -oldDelta);
            // Apply new balance on new account
            long newDelta = balanceService.calculateDelta(txn.getType(), request.amount());
            balanceService.adjustBalance(newAccountId, newDelta);
        } else {
            long oldDelta = balanceService.calculateDelta(txn.getType(), txn.getAmount());
            long newDelta = balanceService.calculateDelta(txn.getType(), request.amount());
            long balanceAdjustment = newDelta - oldDelta;
            if (balanceAdjustment != 0) {
                balanceService.adjustBalance(oldAccountId, balanceAdjustment);
            }
        }

        txn.setAccountId(newAccountId);
        txn.setAmount(request.amount());
        if (request.categoryId() != null) {
            txn.setCategoryId(request.categoryId());
        }
        txn.setDate(request.date());
        txn.setDescription(request.description());
        txn.setTags(request.tagIds());
        transactionRepository.save(txn);

        // Edit cascade: update linked debt payments or debt amounts
        if (txn.getDebtLinks() != null) {
            var amountOverrides = request.debtLinkAmounts();
            boolean linksChanged = false;

            for (var link : txn.getDebtLinks()) {
                // Apply amount override if provided
                long linkAmount = link.getAmount();
                if (amountOverrides != null && amountOverrides.containsKey(link.getDebtRecordId())) {
                    linkAmount = amountOverrides.get(link.getDebtRecordId());
                    link.setAmount(linkAmount);
                    linksChanged = true;
                }

                if (link.getPaymentId() != null) {
                    // UC1: linked payment — update amount, date, description
                    debtRecordService.updatePaymentFromTransaction(
                            link.getDebtRecordId(), link.getPaymentId(),
                            linkAmount, request.date(), request.description());
                } else {
                    // UC2/UC3: originating debt — update the debt amount
                    debtRecordService.updateDebtAmountFromTransaction(
                            link.getDebtRecordId(), linkAmount);
                }
            }

            if (linksChanged) {
                transactionRepository.save(txn);
            }
        }

        return enrichWithNames(List.of(txn)).getFirst();
    }

    private TransactionResponse updateTransfer(Transaction txn, UpdateTransactionRequest request) {
        long oldAmount = txn.getAmount();
        long newAmount = request.amount();
        long oldTargetAmount = txn.getTargetAmount();
        long newTargetAmount = request.targetAmount() != null ? request.targetAmount() : oldTargetAmount;

        String oldSourceId = txn.getAccountId();
        String oldTargetId = txn.getTargetAccountId();
        String newSourceId = request.accountId() != null ? request.accountId() : oldSourceId;
        String newTargetId = request.targetAccountId() != null ? request.targetAccountId() : oldTargetId;

        if (newSourceId.equals(newTargetId)) {
            throw new BusinessRuleException("Source and target accounts must be different");
        }

        if (!newSourceId.equals(oldSourceId)) {
            validateAccountExists(newSourceId);
        }
        if (!newTargetId.equals(oldTargetId)) {
            validateAccountExists(newTargetId);
        }

        // Reverse old balances
        balanceService.adjustBalance(oldSourceId, oldAmount);
        balanceService.adjustBalance(oldTargetId, -oldTargetAmount);

        // Apply new balances
        balanceService.adjustBalance(newSourceId, -newAmount);
        balanceService.adjustBalance(newTargetId, newTargetAmount);

        txn.setAccountId(newSourceId);
        txn.setTargetAccountId(newTargetId);
        txn.setAmount(newAmount);
        txn.setTargetAmount(newTargetAmount);
        txn.setExchangeRate((double) newTargetAmount / newAmount);
        txn.setDate(request.date());
        txn.setDescription(request.description());
        txn.setTags(request.tagIds());
        transactionRepository.save(txn);

        return enrichWithNames(List.of(txn)).getFirst();
    }

    private Transaction getActiveTransaction(String id) {
        return transactionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction", id));
    }

    private void validateAccountExists(String accountId) {
        if (!accountRepository.existsById(accountId)) {
            throw new ResourceNotFoundException("Account", accountId);
        }
    }

    private void validateCategoryForTransaction(String categoryId, TransactionType transactionType) {
        var category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Category", categoryId));
        var catType = category.getType();
        if (catType == CategoryType.BOTH) return;
        var expected = transactionType == TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
        if (catType != expected) {
            throw new BusinessRuleException(
                    "Category '" + category.getName() + "' is " + catType
                            + " but transaction type is " + transactionType);
        }
    }

    private void validateDebtLinkingParams(List<DebtLinkRequest> debtLinks, List<NewDebtRequest> newDebts,
                                           long transactionAmount, TransactionType type) {
        // UC1 links: no total-amount check — amounts are in debt currency (may differ from
        // transaction currency in cross-currency scenarios). Each individual link is validated
        // against the debt record's remaining amount in applyPaymentFromTransaction.

        // UC2/UC3 new debts: total must not exceed transaction amount (same currency)
        boolean hasNewDebts = newDebts != null && !newDebts.isEmpty();
        if (hasNewDebts) {
            long totalNewDebt = newDebts.stream()
                    .mapToLong(r -> r.amount() != null ? r.amount() : transactionAmount)
                    .sum();
            if (totalNewDebt > transactionAmount) {
                throw new BusinessRuleException(
                        "Total new debt amount (" + totalNewDebt + ") exceeds transaction amount (" + transactionAmount + ")");
            }
        }
    }

    private void validateDebtRecordForLinking(String debtRecordId, DebtType expectedType) {
        var record = debtRecordRepository.findByIdAndDeletedFalse(debtRecordId)
                .orElseThrow(() -> new ResourceNotFoundException("DebtRecord", debtRecordId));

        if (record.getStatus() == DebtStatus.CLOSED) {
            throw new BusinessRuleException("Cannot link to a closed debt record");
        }

        if (record.getType() != expectedType) {
            String expected = expectedType == DebtType.DEBT ? "DEBT" : "LOAN";
            String actual = record.getType() == DebtType.DEBT ? "DEBT" : "LOAN";
            throw new BusinessRuleException(
                    "Expected " + expected + " record but found " + actual);
        }
    }

    private List<TransactionResponse> enrichWithNames(List<Transaction> transactions) {
        var accountIds = new HashSet<String>();
        var categoryIds = new HashSet<String>();
        var tagIds = new ArrayList<String>();
        var debtRecordIds = new HashSet<String>();

        for (var txn : transactions) {
            accountIds.add(txn.getAccountId());
            if (txn.getTargetAccountId() != null) accountIds.add(txn.getTargetAccountId());
            if (txn.getCategoryId() != null) categoryIds.add(txn.getCategoryId());
            if (txn.getTags() != null) tagIds.addAll(txn.getTags());
            if (txn.getDebtLinks() != null) {
                for (var link : txn.getDebtLinks()) {
                    debtRecordIds.add(link.getDebtRecordId());
                }
            }
        }

        var accountNames = accountRepository.findAllById(accountIds).stream()
                .collect(Collectors.toMap(Account::getId, Account::getName));

        Map<String, String> categoryNames = categoryIds.isEmpty()
                ? Map.of()
                : categoryRepository.findAllById(categoryIds).stream()
                        .collect(Collectors.toMap(Category::getId, Category::getName));

        var tagNamesMap = tagService.getTagNamesByIds(tagIds);

        // Batch-fetch debt records for enrichment
        Map<String, DebtRecord> debtRecordMap = debtRecordIds.isEmpty()
                ? Map.of()
                : debtRecordRepository.findAllById(debtRecordIds).stream()
                        .collect(Collectors.toMap(DebtRecord::getId, Function.identity()));

        // Fetch person names for debt records
        var debtPersonIds = debtRecordMap.values().stream()
                .map(DebtRecord::getPersonId)
                .collect(Collectors.toSet());
        Map<String, String> personNames = debtPersonIds.isEmpty()
                ? Map.of()
                : new HashMap<>();
        if (!debtPersonIds.isEmpty()) {
            var persons = mongoTemplate.find(
                    Query.query(Criteria.where("_id").in(debtPersonIds)),
                    com.goldscale.model.Person.class);
            for (var p : persons) {
                personNames.put(p.getId(), p.getName());
            }
        }

        return transactions.stream()
                .map(txn -> {
                    List<DebtLinkResponse> debtLinks = null;
                    if (txn.getDebtLinks() != null && !txn.getDebtLinks().isEmpty()) {
                        debtLinks = txn.getDebtLinks().stream()
                                .map(link -> {
                                    var dr = debtRecordMap.get(link.getDebtRecordId());
                                    String personName = dr != null
                                            ? personNames.getOrDefault(dr.getPersonId(), "Unknown")
                                            : "Unknown";
                                    return new DebtLinkResponse(
                                            link.getDebtRecordId(),
                                            link.getPaymentId(),
                                            link.getAmount(),
                                            personName,
                                            dr != null ? dr.getType() : null,
                                            dr != null ? dr.getDescription() : null
                                    );
                                })
                                .toList();
                    }
                    return TransactionResponse.from(txn, accountNames, categoryNames, tagNamesMap, debtLinks);
                })
                .toList();
    }
}
