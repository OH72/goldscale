package com.goldscale.dto.response;

import com.goldscale.model.DebtType;

public record DebtLinkResponse(
        String debtRecordId,
        String paymentId,
        long amount,
        String personName,
        DebtType debtType,
        String debtDescription
) {}
