package com.goldscale.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpdateTagRequest(
        @NotBlank String name
) {}
