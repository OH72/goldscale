package com.goldscale.dto.request;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

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
            String description,
            List<String> tagIds
    ) implements TransactionCommand {
        public CreateIncome(String accountId, Long amount, String categoryId, LocalDate date, String description) {
            this(accountId, amount, categoryId, date, description, null);
        }
    }

    record CreateExpense(
            @NotNull String accountId,
            @NotNull @Min(1) Long amount,
            @NotNull String categoryId,
            @NotNull LocalDate date,
            String description,
            List<String> tagIds
    ) implements TransactionCommand {
        public CreateExpense(String accountId, Long amount, String categoryId, LocalDate date, String description) {
            this(accountId, amount, categoryId, date, description, null);
        }
    }

    record CreateTransfer(
            @NotNull String sourceAccountId,
            @NotNull String targetAccountId,
            @NotNull @Min(1) Long amount,
            @NotNull @Min(1) Long targetAmount,
            @NotNull LocalDate date,
            String description,
            List<String> tagIds
    ) implements TransactionCommand {
        public CreateTransfer(String sourceAccountId, String targetAccountId, Long amount, Long targetAmount, LocalDate date, String description) {
            this(sourceAccountId, targetAccountId, amount, targetAmount, date, description, null);
        }
    }
}
