package com.goldscale.service;

import com.goldscale.dto.request.ConfirmRow;
import com.goldscale.dto.request.ImportConfirmRequest;
import com.goldscale.dto.response.ImportConfirmResponse;
import com.goldscale.dto.response.ImportPreviewResponse;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.model.*;
import com.goldscale.repository.AccountRepository;
import com.goldscale.repository.CategoryRepository;
import com.goldscale.service.parser.ParserDetector;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ImportService {

    private final ParserDetector parserDetector;
    private final TransactionService transactionService;
    private final TagService tagService;
    private final AccountRepository accountRepository;
    private final CategoryRepository categoryRepository;
    private final MongoTemplate mongoTemplate;

    public ImportPreviewResponse preview(MultipartFile file, BankType bankType) {
        validateFile(file);

        var pdfText = extractText(file);
        var parser = parserDetector.getParser(bankType);
        var rows = parser.parse(pdfText);

        return new ImportPreviewResponse(rows, parser.getBankName(), parser.getDetectedCurrency());
    }

    @Transactional
    public ImportConfirmResponse confirmImport(ImportConfirmRequest request) {
        var isMoneyManager = request.bankType() == BankType.MONEYMANAGER;

        // Build name-to-ID caches for auto-created entities
        var accountCache = buildAccountCache();
        var categoryCache = buildCategoryCache();

        // Auto-create accounts referenced by name
        if (isMoneyManager) {
            autoCreateAccounts(request.rows(), accountCache);
        }

        // Auto-create categories referenced by name
        autoCreateCategories(request.rows(), categoryCache);

        // Pre-load existing transactions for batch dedup
        var existingKeys = preLoadDedupKeys(request);

        int imported = 0;
        int skipped = 0;

        for (var row : request.rows()) {
            if (row.type() == TransactionType.INITIAL_BALANCE) {
                handleInitialBalance(row, accountCache);
                imported++;
                continue;
            }

            // Resolve account ID
            var accountId = resolveAccountId(row, request.accountId(), accountCache);

            // Build dedup key and check
            var dedupKey = buildDedupKey(accountId, row);
            if (existingKeys.contains(dedupKey)) {
                skipped++;
                continue;
            }

            // Resolve tags
            List<String> tagIds = null;
            if (row.tags() != null && !row.tags().isEmpty()) {
                tagIds = tagService.resolveTagNames(row.tags());
            }

            if (row.type() == TransactionType.TRANSFER) {
                var targetAccountId = resolveTargetAccountId(row, accountCache);
                if (accountId.equals(targetAccountId)) {
                    skipped++;
                    continue;
                }
                long targetAmount = row.targetAmount() != null ? row.targetAmount() : row.amount();
                transactionService.createTransfer(
                        accountId, targetAccountId,
                        row.amount(), targetAmount,
                        row.date(), row.description(), tagIds);
            } else {
                var categoryId = resolveCategoryId(row, categoryCache);
                transactionService.createIncomeOrExpense(
                        accountId, row.amount(), categoryId,
                        row.date(), row.description(), row.type(), tagIds);
            }

            imported++;
        }

        return new ImportConfirmResponse(imported, skipped);
    }

    // --- Account resolution ---

    private Map<String, String> buildAccountCache() {
        return accountRepository.findAll().stream()
                .collect(Collectors.toMap(Account::getName, Account::getId, (a, b) -> a));
    }

    private void autoCreateAccounts(List<ConfirmRow> rows, Map<String, String> cache) {
        var accountNames = new HashSet<String>();
        for (var row : rows) {
            if (row.accountName() != null && !row.accountName().isBlank()) {
                accountNames.add(row.accountName().trim());
            }
            if (row.targetAccountName() != null && !row.targetAccountName().isBlank()) {
                accountNames.add(row.targetAccountName().trim());
            }
        }

        for (var name : accountNames) {
            if (!cache.containsKey(name)) {
                var currency = findCurrencyForAccount(name, rows);
                var account = new Account();
                account.setName(name);
                account.setCurrency(currency);
                account.setBalance(0);
                account = accountRepository.save(account);

                // Create INITIAL_BALANCE transaction with 0
                var txn = new Transaction();
                txn.setType(TransactionType.INITIAL_BALANCE);
                txn.setAccountId(account.getId());
                txn.setAmount(0);
                txn.setDate(LocalDate.now());
                txn.setDeleted(false);
                mongoTemplate.save(txn);

                cache.put(name, account.getId());
            }
        }
    }

    private Currency findCurrencyForAccount(String accountName, List<ConfirmRow> rows) {
        for (var row : rows) {
            if (accountName.equals(row.accountName()) && row.currency() != null) {
                try {
                    return Currency.valueOf(row.currency());
                } catch (IllegalArgumentException ignored) {}
            }
            if (accountName.equals(row.targetAccountName()) && row.targetCurrency() != null) {
                try {
                    return Currency.valueOf(row.targetCurrency());
                } catch (IllegalArgumentException ignored) {}
            }
        }
        return Currency.UAH;
    }

    private String resolveAccountId(ConfirmRow row, String fallbackAccountId, Map<String, String> cache) {
        // Row-level accountId takes precedence
        if (row.accountId() != null && !row.accountId().isBlank()) {
            return row.accountId();
        }
        // Resolve by name
        if (row.accountName() != null && !row.accountName().isBlank()) {
            var id = cache.get(row.accountName().trim());
            if (id != null) return id;
            throw new BusinessRuleException("Account not found: " + row.accountName());
        }
        // Fall back to request-level accountId
        if (fallbackAccountId != null && !fallbackAccountId.isBlank()) {
            return fallbackAccountId;
        }
        throw new BusinessRuleException("No account specified for row");
    }

    private String resolveTargetAccountId(ConfirmRow row, Map<String, String> cache) {
        if (row.targetAccountId() != null && !row.targetAccountId().isBlank()) {
            return row.targetAccountId();
        }
        if (row.targetAccountName() != null && !row.targetAccountName().isBlank()) {
            var id = cache.get(row.targetAccountName().trim());
            if (id != null) return id;
            throw new BusinessRuleException("Target account not found: " + row.targetAccountName());
        }
        throw new BusinessRuleException("TRANSFER requires target account");
    }

    // --- Category resolution ---

    private Map<String, String> buildCategoryCache() {
        var cache = new HashMap<String, String>();
        for (var cat : categoryRepository.findAll()) {
            cache.put(cat.getName(), cat.getId());
        }
        return cache;
    }

    private void autoCreateCategories(List<ConfirmRow> rows, Map<String, String> cache) {
        for (var row : rows) {
            if (row.categoryName() == null || row.categoryName().isBlank()) continue;
            if (row.type() == TransactionType.TRANSFER || row.type() == TransactionType.INITIAL_BALANCE) continue;

            var key = row.categoryName().trim();

            if (!cache.containsKey(key)) {
                var category = new Category();
                category.setName(key);
                category.setType(CategoryType.BOTH);
                category = categoryRepository.save(category);
                cache.put(key, category.getId());
            }
        }
    }

    private String resolveCategoryId(ConfirmRow row, Map<String, String> cache) {
        if (row.categoryId() != null && !row.categoryId().isBlank()) {
            return row.categoryId();
        }
        if (row.categoryName() != null && !row.categoryName().isBlank()) {
            return cache.get(row.categoryName().trim());
        }
        return null;
    }

    // --- Initial balance handling ---

    private void handleInitialBalance(ConfirmRow row, Map<String, String> cache) {
        if (row.accountName() == null || row.accountName().isBlank()) {
            throw new BusinessRuleException("INITIAL_BALANCE requires accountName");
        }

        var accountId = cache.get(row.accountName().trim());
        if (accountId == null) {
            throw new BusinessRuleException("Account not found for INITIAL_BALANCE: " + row.accountName());
        }

        // Update the existing INITIAL_BALANCE transaction amount and account balance
        var existingIb = mongoTemplate.findOne(
                Query.query(Criteria.where("accountId").is(accountId)
                        .and("type").is(TransactionType.INITIAL_BALANCE)
                        .and("deleted").ne(true)),
                Transaction.class);

        if (existingIb != null) {
            long delta = row.amount() - existingIb.getAmount();
            if (delta != 0) {
                existingIb.setAmount(row.amount());
                mongoTemplate.save(existingIb);
                mongoTemplate.updateFirst(
                        Query.query(Criteria.where("_id").is(accountId)),
                        new Update().inc("balance", delta).set("updatedAt", Instant.now()),
                        Account.class);
            }
        }
    }

    // --- Dedup ---

    private Set<String> preLoadDedupKeys(ImportConfirmRequest request) {
        var keys = new HashSet<String>();

        // Collect all account IDs referenced in this import
        var accountIds = new HashSet<String>();
        if (request.accountId() != null) accountIds.add(request.accountId());
        // Can't resolve name-based accounts here easily, so we do field-matching dedup

        var criteria = Criteria.where("deleted").ne(true);
        if (!accountIds.isEmpty()) {
            criteria = criteria.and("accountId").in(accountIds);
        }

        var existing = mongoTemplate.find(Query.query(criteria), Transaction.class);
        for (var txn : existing) {
            keys.add(txn.getAccountId() + "|" + txn.getDate() + "|" + txn.getAmount()
                    + "|" + txn.getDescription() + "|" + txn.getType());
        }

        return keys;
    }

    private String buildDedupKey(String accountId, ConfirmRow row) {
        return accountId + "|" + row.date() + "|" + row.amount()
                + "|" + row.description() + "|" + row.type();
    }

    // --- Validation ---

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new BusinessRuleException("File is empty");
        }

        var contentType = file.getContentType();
        if (contentType == null || !contentType.equals("application/pdf")) {
            throw new BusinessRuleException("File must be a PDF document");
        }
    }

    private String extractText(MultipartFile file) {
        try (var document = Loader.loadPDF(file.getInputStream().readAllBytes())) {
            var stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            return stripper.getText(document).replace('\u00A0', ' ');
        } catch (IOException e) {
            throw new BusinessRuleException("Failed to read PDF file: " + e.getMessage());
        }
    }
}
