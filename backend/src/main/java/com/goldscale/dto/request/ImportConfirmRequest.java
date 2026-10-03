package com.goldscale.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record ImportConfirmRequest(
        @NotBlank String accountId,
        @NotEmpty List<@Valid ConfirmRow> rows
) {}
