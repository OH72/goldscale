package com.goldscale.dto.response;

import com.goldscale.model.TransactionType;

import java.time.LocalDate;

public record ImportRow(
        int index,
        TransactionType type,
        long amount,
        LocalDate date,
        String description,
        String categoryHint,
        String sourceRef
) {}
