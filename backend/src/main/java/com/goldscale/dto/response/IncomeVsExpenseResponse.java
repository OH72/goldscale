package com.goldscale.dto.response;

public record IncomeVsExpenseResponse(
        String period,
        long income,
        long expense,
        long net
) {}
