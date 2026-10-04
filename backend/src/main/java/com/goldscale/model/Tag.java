package com.goldscale.model;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Getter
@Setter
@Document("tags")
public class Tag {
    @Id
    private String id;
    @Indexed(unique = true)
    private String name;
    @CreatedDate
    private Instant createdAt;
}
