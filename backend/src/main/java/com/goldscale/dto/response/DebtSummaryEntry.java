package com.goldscale.dto.response;

public record DebtSummaryEntry(
        String personId,
        String personName,
        long totalDebt,
        long totalLoan,
        long net
) {}
