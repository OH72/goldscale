package com.goldscale.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ReconcileRequest(
        @NotBlank String counterpartId,
        @NotNull @Min(1) Long sourceAmount,
        @NotNull @Min(1) Long counterpartAmount
) {}
