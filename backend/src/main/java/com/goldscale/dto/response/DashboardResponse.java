package com.goldscale.dto.response;

import com.goldscale.model.Currency;

import java.util.List;

public record DashboardResponse(
        List<AccountResponse> accounts,
        List<TransactionResponse> recentTransactions,
        long totalNetWorth,
        Currency displayCurrency
) {}
