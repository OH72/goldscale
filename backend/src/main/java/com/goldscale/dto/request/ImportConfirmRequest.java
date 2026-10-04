package com.goldscale.dto.request;

import com.goldscale.model.BankType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ImportConfirmRequest(
        String accountId,
        @NotNull BankType bankType,
        @NotEmpty List<@Valid ConfirmRow> rows
) {}
