package com.goldscale.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record AddPaymentRequest(
        @NotNull @Min(1) Long amount,
        @NotNull LocalDate date,
        String description
) {}
