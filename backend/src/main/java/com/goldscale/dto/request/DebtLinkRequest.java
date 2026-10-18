package com.goldscale.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record DebtLinkRequest(
        @NotNull String debtRecordId,
        @NotNull @Min(1) Long amount
) {}
