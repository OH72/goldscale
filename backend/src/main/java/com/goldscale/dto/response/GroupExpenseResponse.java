package com.goldscale.dto.response;

public record GroupExpenseResponse(
        String id,
        String name,
        long amount
) {}
