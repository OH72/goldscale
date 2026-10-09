package com.goldscale.dto.response;

import com.goldscale.model.Person;

import java.time.Instant;

/**
 * Debt amounts are open-record totals converted to the display currency (subunits).
 * canOffset is true when open debts can be offset against open loans in a shared currency.
 */
public record PersonResponse(
        String id,
        String name,
        Instant createdAt,
        long totalDebt,
        long totalLoan,
        long net,
        boolean canOffset
) {
    public static PersonResponse from(Person person) {
        return new PersonResponse(person.getId(), person.getName(), person.getCreatedAt(), 0, 0, 0, false);
    }

    public static PersonResponse from(Person person, DebtSummaryEntry summary, boolean canOffset) {
        if (summary == null) {
            return from(person);
        }
        return new PersonResponse(person.getId(), person.getName(), person.getCreatedAt(),
                summary.totalDebt(), summary.totalLoan(), summary.net(), canOffset);
    }
}
