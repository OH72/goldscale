package com.goldscale.dto.response;

import com.goldscale.model.Account;
import com.goldscale.model.Currency;

import java.time.Instant;

/**
 * {@code balanceInDisplayCurrency} is populated only by GET /accounts (null when no exchange rate
 * is available); it is null in create/update/findById/dashboard responses.
 */
public record AccountResponse(
        String id,
        String name,
        Currency currency,
        long balance,
        boolean active,
        String color,
        Instant createdAt,
        Long balanceInDisplayCurrency
) {
    public static AccountResponse from(Account account) {
        return from(account, null);
    }

    public static AccountResponse from(Account account, Long balanceInDisplayCurrency) {
        return new AccountResponse(
                account.getId(),
                account.getName(),
                account.getCurrency(),
                account.getBalance(),
                account.isActive(),
                account.getColor(),
                account.getCreatedAt(),
                balanceInDisplayCurrency
        );
    }
}
