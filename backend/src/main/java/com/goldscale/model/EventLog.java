package com.goldscale.model;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document
@Getter
@Setter
public class EventLog {
    @Id
    private String id;
    private String action;
    private String entityType;
    private String entityId;
    private String description;
    private Instant timestamp;
}
