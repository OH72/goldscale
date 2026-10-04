package com.goldscale.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record UpdateTransactionRequest(
        @NotNull @Min(0) Long amount,
        String categoryId,
        @NotNull LocalDate date,
        String description,
        // Transfer-only fields
        @Min(1) Long targetAmount
) {}
