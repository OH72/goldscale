package com.goldscale.dto.request;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
        @JsonSubTypes.Type(value = TransactionCommand.CreateIncome.class, name = "INCOME"),
        @JsonSubTypes.Type(value = TransactionCommand.CreateExpense.class, name = "EXPENSE"),
        @JsonSubTypes.Type(value = TransactionCommand.CreateTransfer.class, name = "TRANSFER")
})
public sealed interface TransactionCommand {

    record CreateIncome(
            @NotNull String accountId,
            @NotNull @Min(1) Long amount,
            @NotNull String categoryId,
            @NotNull LocalDate date,
            String description
    ) implements TransactionCommand {}

    record CreateExpense(
            @NotNull String accountId,
            @NotNull @Min(1) Long amount,
            @NotNull String categoryId,
            @NotNull LocalDate date,
            String description
    ) implements TransactionCommand {}

    record CreateTransfer(
            @NotNull String sourceAccountId,
            @NotNull String targetAccountId,
            @NotNull @Min(1) Long amount,
            @NotNull @Min(1) Long targetAmount,
            @NotNull LocalDate date,
            String description
    ) implements TransactionCommand {}
}
