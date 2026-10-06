package com.goldscale.dto.request;

import com.goldscale.model.Currency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateAccountRequest(
        @NotBlank String name,
        @NotNull Currency currency,
        @NotNull Boolean active,
        String color
) {
    public UpdateAccountRequest(String name, Currency currency, Boolean active) {
        this(name, currency, active, null);
    }
}
