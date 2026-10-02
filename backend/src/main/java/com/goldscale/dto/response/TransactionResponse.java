package com.goldscale.dto.response;

import com.goldscale.model.Transaction;
import com.goldscale.model.TransactionType;

import java.time.Instant;
import java.time.LocalDate;
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
        Instant createdAt
) {
    public static TransactionResponse from(
            Transaction txn,
            Map<String, String> accountNames,
            Map<String, String> categoryNames) {
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
                txn.getCreatedAt()
        );
    }
}
