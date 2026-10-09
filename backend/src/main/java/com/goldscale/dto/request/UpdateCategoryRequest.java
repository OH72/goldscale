package com.goldscale.dto.request;

import com.goldscale.model.CategoryType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateCategoryRequest(
        @NotBlank String name,
        @NotNull CategoryType type,
        String icon
) {}
