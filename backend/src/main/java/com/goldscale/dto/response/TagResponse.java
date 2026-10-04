package com.goldscale.dto.response;

import com.goldscale.model.Tag;

import java.time.Instant;

public record TagResponse(
        String id,
        String name,
        Instant createdAt
) {
    public static TagResponse from(Tag tag) {
        return new TagResponse(tag.getId(), tag.getName(), tag.getCreatedAt());
    }
}
