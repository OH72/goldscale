package com.goldscale.dto.response;

import java.util.List;

public record OffsetResponse(
        String personId,
        String personName,
        List<OffsetCurrencyEntry> currencies
) {}
