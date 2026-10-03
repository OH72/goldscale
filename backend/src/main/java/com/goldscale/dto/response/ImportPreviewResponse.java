package com.goldscale.dto.response;

import java.util.List;

public record ImportPreviewResponse(
        List<ImportRow> rows,
        String bankName,
        String detectedCurrency
) {}
