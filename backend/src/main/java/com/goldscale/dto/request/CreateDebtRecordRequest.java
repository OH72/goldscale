package com.goldscale.dto.request;

import com.goldscale.model.Currency;
import com.goldscale.model.DebtType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record CreateDebtRecordRequest(
        @NotNull String personId,
        @NotNull DebtType type,
        @NotNull @Min(1) Long amount,
        @NotNull Currency currency,
        String categoryId,
        String description,
        @NotNull LocalDate date
) {}
