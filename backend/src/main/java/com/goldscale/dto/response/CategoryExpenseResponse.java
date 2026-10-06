package com.goldscale.dto.response;

public record CategoryExpenseResponse(
        String categoryId,
        String categoryName,
        long amount
) {}
