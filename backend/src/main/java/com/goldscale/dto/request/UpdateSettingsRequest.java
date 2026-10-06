package com.goldscale.dto.request;

import com.goldscale.model.Currency;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record UpdateSettingsRequest(
        Currency displayCurrency,
        LocalDate initialDate
) {}
