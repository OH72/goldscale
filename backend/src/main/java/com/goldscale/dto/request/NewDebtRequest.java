package com.goldscale.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record NewDebtRequest(
        @NotNull String personId,
        @Min(1) Long amount
) {}
