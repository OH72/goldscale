package com.goldscale.model;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Document("exchange_rates")
@Getter
@Setter
public class ExchangeRate {
    @Id
    private String id; // ISO date "2026-10-06"
    private Map<String, Long> rates = new HashMap<>(); // currency -> USD-based rate (×1_000_000)
    @CreatedDate
    private Instant createdAt;
}
