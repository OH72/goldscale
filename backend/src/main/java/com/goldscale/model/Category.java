package com.goldscale.model;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Getter
@Setter
@Document("categories")
@CompoundIndex(name = "name_type_idx", def = "{'name': 1, 'type': 1}", unique = true)
public class Category {

    @Id
    private String id;

    private String name;

    private CategoryType type;

    private String icon;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
