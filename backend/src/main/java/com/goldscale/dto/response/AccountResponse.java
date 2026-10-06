package com.goldscale.dto.response;

import com.goldscale.model.Account;
import com.goldscale.model.Currency;

import java.time.Instant;

public record AccountResponse(
        String id,
        String name,
        Currency currency,
        long balance,
        boolean active,
        String color,
        Instant createdAt
) {
    public static AccountResponse from(Account account) {
        return new AccountResponse(
                account.getId(),
                account.getName(),
                account.getCurrency(),
                account.getBalance(),
                account.isActive(),
                account.getColor(),
                account.getCreatedAt()
        );
    }
}
