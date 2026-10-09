package com.goldscale.dto.response;

import com.goldscale.model.Currency;

import java.util.List;

public record DebtSummaryResponse(
        Currency displayCurrency,
        List<DebtSummaryEntry> entries
) {}
