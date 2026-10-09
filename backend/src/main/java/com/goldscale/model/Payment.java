package com.goldscale.model;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Getter
@Setter
public class Payment {
    private String id;
    private long amount;
    private LocalDate date;
    private String description;
    private Instant createdAt;
}
