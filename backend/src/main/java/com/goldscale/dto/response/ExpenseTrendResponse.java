package com.goldscale.dto.response;

import java.util.List;

public record ExpenseTrendResponse(
        String period,
        List<CategoryExpenseResponse> categories
) {}
