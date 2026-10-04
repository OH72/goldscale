package com.goldscale.dto.response;

import com.goldscale.model.TransactionType;

import java.time.LocalDate;
import java.util.List;

public record ImportRow(
        int index,
        TransactionType type,
        long amount,
        LocalDate date,
        String description,
        String categoryHint,
        String sourceRef,
        String accountName,
        String targetAccountName,
        Long targetAmount,
        String currency,
        String targetCurrency,
        List<String> tags
) {
    /**
     * Convenience constructor for bank statement parsers (Monobank, Millennium, Kredobank)
     * that don't provide per-row account/tags info.
     */
    public ImportRow(int index, TransactionType type, long amount, LocalDate date,
                     String description, String categoryHint, String sourceRef) {
        this(index, type, amount, date, description, categoryHint, sourceRef,
                null, null, null, null, null, null);
    }
}
