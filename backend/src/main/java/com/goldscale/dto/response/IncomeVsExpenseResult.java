package com.goldscale.dto.response;

import java.util.List;

public record IncomeVsExpenseResult(
        long priorNet,
        List<IncomeVsExpenseResponse> months
) {}
