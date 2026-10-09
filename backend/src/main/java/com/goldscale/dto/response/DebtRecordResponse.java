package com.goldscale.dto.response;

import com.goldscale.model.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record DebtRecordResponse(
        String id,
        String personId,
        String personName,
        DebtType type,
        long amount,
        long coveredAmount,
        long remainingAmount,
        Currency currency,
        String categoryId,
        String categoryName,
        String description,
        LocalDate date,
        DebtStatus status,
        List<PaymentResponse> payments,
        Instant createdAt,
        Instant updatedAt
) {
    public static DebtRecordResponse from(DebtRecord record, String personName, String categoryName) {
        return new DebtRecordResponse(
                record.getId(),
                record.getPersonId(),
                personName,
                record.getType(),
                record.getAmount(),
                record.getCoveredAmount(),
                record.getAmount() - record.getCoveredAmount(),
                record.getCurrency(),
                record.getCategoryId(),
                categoryName,
                record.getDescription(),
                record.getDate(),
                record.getStatus(),
                record.getPayments() == null ? List.of() :
                        record.getPayments().stream().map(PaymentResponse::from).toList(),
                record.getCreatedAt(),
                record.getUpdatedAt()
        );
    }
}
