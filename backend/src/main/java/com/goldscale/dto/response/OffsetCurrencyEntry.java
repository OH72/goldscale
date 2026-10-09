package com.goldscale.dto.response;

import com.goldscale.model.Currency;

import java.util.List;

public record OffsetCurrencyEntry(
        Currency currency,
        long amount,
        List<OffsetAllocation> debts,
        List<OffsetAllocation> loans
) {}
