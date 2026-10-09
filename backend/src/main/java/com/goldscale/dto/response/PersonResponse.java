package com.goldscale.dto.response;

import com.goldscale.model.Person;

import java.time.Instant;

public record PersonResponse(
        String id,
        String name,
        Instant createdAt
) {
    public static PersonResponse from(Person person) {
        return new PersonResponse(person.getId(), person.getName(), person.getCreatedAt());
    }
}
