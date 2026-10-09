package com.goldscale.dto.response;

import java.time.LocalDate;

public record OffsetAllocation(
        String recordId,
        String description,
        LocalDate date,
        long remainingBefore,
        long amount,
        long remainingAfter
) {}
