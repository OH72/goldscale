package com.goldscale.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpdatePersonRequest(
        @NotBlank String name
) {}
