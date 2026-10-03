package com.goldscale.dto.request;

import com.goldscale.model.TransactionType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record ConfirmRow(
        @NotNull TransactionType type,
        @NotNull @Min(1) Long amount,
        @NotNull LocalDate date,
        String description,
        String categoryId,
        String sourceRef,
        String targetAccountId,
        @Min(1) Long targetAmount
) {}
