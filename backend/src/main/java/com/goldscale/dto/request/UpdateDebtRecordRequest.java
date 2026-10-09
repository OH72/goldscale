package com.goldscale.dto.request;

import com.goldscale.model.Currency;
import com.goldscale.model.DebtType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public record UpdateDebtRecordRequest(
        String personId,
        DebtType type,
        @NotNull @Min(1) Long amount,
        @NotNull Currency currency,
        String categoryId,
        List<String> tagIds,
        String description,
        @NotNull LocalDate date
) {
    public UpdateDebtRecordRequest(String personId, DebtType type, Long amount, Currency currency,
                                   String categoryId, String description, LocalDate date) {
        this(personId, type, amount, currency, categoryId, null, description, date);
    }
}
