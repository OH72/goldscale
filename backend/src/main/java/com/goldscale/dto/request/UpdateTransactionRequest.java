package com.goldscale.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record UpdateTransactionRequest(
        @NotNull @Min(0) Long amount,
        String categoryId,
        @NotNull LocalDate date,
        String description,
        // Transfer-only fields
        @Min(1) Long targetAmount,
        String accountId,
        String targetAccountId,
        List<String> tagIds,
        // Debt link amount overrides: debtRecordId -> new amount
        Map<String, Long> debtLinkAmounts
) {
    public UpdateTransactionRequest(Long amount, String categoryId, LocalDate date, String description, Long targetAmount) {
        this(amount, categoryId, date, description, targetAmount, null, null, null, null);
    }
}
