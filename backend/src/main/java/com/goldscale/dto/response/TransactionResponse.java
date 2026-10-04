package com.goldscale.dto.response;

import com.goldscale.model.Transaction;
import com.goldscale.model.TransactionType;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record TransactionResponse(
        String id,
        TransactionType type,
        String accountId,
        String accountName,
        String targetAccountId,
        String targetAccountName,
        String categoryId,
        String categoryName,
        long amount,
        Long targetAmount,
        Double exchangeRate,
        String description,
        LocalDate date,
        List<String> tagIds,
        List<String> tagNames,
        Instant createdAt
) {
    public static TransactionResponse from(
            Transaction txn,
            Map<String, String> accountNames,
            Map<String, String> categoryNames,
            Map<String, String> tagNamesMap) {
        var txnTags = txn.getTags();
        List<String> resolvedTagNames = null;
        if (txnTags != null && !txnTags.isEmpty()) {
            resolvedTagNames = txnTags.stream()
                    .map(id -> tagNamesMap.getOrDefault(id, id))
                    .toList();
        }

        return new TransactionResponse(
                txn.getId(),
                txn.getType(),
                txn.getAccountId(),
                accountNames.getOrDefault(txn.getAccountId(), null),
                txn.getTargetAccountId(),
                txn.getTargetAccountId() != null
                        ? accountNames.getOrDefault(txn.getTargetAccountId(), null) : null,
                txn.getCategoryId(),
                txn.getCategoryId() != null
                        ? categoryNames.getOrDefault(txn.getCategoryId(), null) : null,
                txn.getAmount(),
                txn.getTargetAmount(),
                txn.getExchangeRate(),
                txn.getDescription(),
                txn.getDate(),
                txnTags,
                resolvedTagNames,
                txn.getCreatedAt()
        );
    }
}
