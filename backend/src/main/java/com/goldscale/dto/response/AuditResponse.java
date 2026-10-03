package com.goldscale.dto.response;

public record AuditResponse(
        String accountId,
        long storedBalance,
        long calculatedBalance,
        boolean match
) {}
