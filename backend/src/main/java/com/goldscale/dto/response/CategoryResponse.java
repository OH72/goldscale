package com.goldscale.dto.response;

import com.goldscale.model.Category;
import com.goldscale.model.CategoryType;

import java.time.Instant;

public record CategoryResponse(
        String id,
        String name,
        CategoryType type,
        String icon,
        Instant createdAt
) {
    public static CategoryResponse from(Category category) {
        return new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getType(),
                category.getIcon(),
                category.getCreatedAt()
        );
    }
}
