package com.goldscale.dto.request;

import jakarta.validation.constraints.NotBlank;

public record CreateTagRequest(
        @NotBlank String name
) {}
