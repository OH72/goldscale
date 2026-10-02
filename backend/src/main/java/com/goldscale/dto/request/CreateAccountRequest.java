package com.goldscale.dto.request;

import com.goldscale.model.Currency;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateAccountRequest(
        @NotBlank String name,
        @NotNull Currency currency,
        @NotNull @Min(0) Long initialBalance
) {}
