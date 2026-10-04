package com.goldscale.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public record UpdateTransactionRequest(
        @NotNull @Min(0) Long amount,
        String categoryId,
        @NotNull LocalDate date,
        String description,
        // Transfer-only fields
        @Min(1) Long targetAmount,
        List<String> tagIds
) {
    public UpdateTransactionRequest(Long amount, String categoryId, LocalDate date, String description, Long targetAmount) {
        this(amount, categoryId, date, description, targetAmount, null);
    }
}
