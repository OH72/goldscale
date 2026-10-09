package com.goldscale.dto.response;

import com.goldscale.model.Payment;

import java.time.Instant;
import java.time.LocalDate;

public record PaymentResponse(
        String id,
        long amount,
        LocalDate date,
        String description,
        Instant createdAt
) {
    public static PaymentResponse from(Payment payment) {
        return new PaymentResponse(
                payment.getId(), payment.getAmount(),
                payment.getDate(), payment.getDescription(),
                payment.getCreatedAt()
        );
    }
}
