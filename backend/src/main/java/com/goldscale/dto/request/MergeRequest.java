package com.goldscale.dto.request;

import jakarta.validation.constraints.NotBlank;

public record MergeRequest(
        @NotBlank String targetId
) {}
