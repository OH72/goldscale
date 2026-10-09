package com.goldscale.dto.response;

import com.goldscale.model.Person;

import java.time.Instant;

/**
 * Debt amounts are open-record totals converted to the display currency (subunits).
 */
public record PersonResponse(
        String id,
        String name,
        Instant createdAt,
        long totalDebt,
        long totalLoan,
        long net
) {
    public static PersonResponse from(Person person) {
        return new PersonResponse(person.getId(), person.getName(), person.getCreatedAt(), 0, 0, 0);
    }

    public static PersonResponse from(Person person, DebtSummaryEntry summary) {
        if (summary == null) {
            return from(person);
        }
        return new PersonResponse(person.getId(), person.getName(), person.getCreatedAt(),
                summary.totalDebt(), summary.totalLoan(), summary.net());
    }
}
