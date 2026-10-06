package com.goldscale.dto.response;

import com.goldscale.model.Currency;

import java.util.List;

public record DashboardResponse(
        List<TransactionResponse> recentTransactions,
        long totalNetWorth,
        Currency displayCurrency
) {}
