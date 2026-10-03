package com.goldscale.dto.response;

import java.util.List;

public record DashboardResponse(
        List<AccountResponse> accounts,
        List<TransactionResponse> recentTransactions
) {}
