package com.goldscale.dto.request;

import jakarta.validation.constraints.NotBlank;

public record CreatePersonRequest(
        @NotBlank String name
) {}
