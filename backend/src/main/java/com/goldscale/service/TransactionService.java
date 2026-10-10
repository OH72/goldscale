package com.goldscale.service;

import com.goldscale.dto.request.TransactionCommand;
import com.goldscale.dto.request.TransactionCommand.*;
import com.goldscale.dto.request.UpdateTransactionRequest;
import com.goldscale.dto.response.TransactionResponse;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.*;
import com.goldscale.repository.AccountRepository;
import com.goldscale.repository.CategoryRepository;
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
    private final BalanceService balanceService;
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
                    cmd.date(), cmd.description(), TransactionType.INCOME, cmd.tagIds());
            case CreateExpense cmd -> createIncomeOrExpense(
                    cmd.accountId(), cmd.amount(), cmd.categoryId(),
                    cmd.date(), cmd.description(), TransactionType.EXPENSE, cmd.tagIds());
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
    }

    // --- Internal helpers ---

    Transaction createIncomeOrExpense(
            String accountId, long amount, String categoryId,
            LocalDate date, String description, TransactionType type) {
        return createIncomeOrExpense(accountId, amount, categoryId, date, description, type, null);
    }

    Transaction createIncomeOrExpense(
            String accountId, long amount, String categoryId,
            LocalDate date, String description, TransactionType type, List<String> tagIds) {

        validateAccountExists(accountId);
        if (categoryId != null) {
            validateCategoryForTransaction(categoryId, type);
        }

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

    private List<TransactionResponse> enrichWithNames(List<Transaction> transactions) {
        var accountIds = new HashSet<String>();
        var categoryIds = new HashSet<String>();
        var tagIds = new ArrayList<String>();

        for (var txn : transactions) {
            accountIds.add(txn.getAccountId());
            if (txn.getTargetAccountId() != null) accountIds.add(txn.getTargetAccountId());
            if (txn.getCategoryId() != null) categoryIds.add(txn.getCategoryId());
            if (txn.getTags() != null) tagIds.addAll(txn.getTags());
        }

        var accountNames = accountRepository.findAllById(accountIds).stream()
                .collect(Collectors.toMap(Account::getId, Account::getName));

        Map<String, String> categoryNames = categoryIds.isEmpty()
                ? Map.of()
                : categoryRepository.findAllById(categoryIds).stream()
                        .collect(Collectors.toMap(Category::getId, Category::getName));

        var tagNamesMap = tagService.getTagNamesByIds(tagIds);

        return transactions.stream()
                .map(txn -> TransactionResponse.from(txn, accountNames, categoryNames, tagNamesMap))
                .toList();
    }
}
