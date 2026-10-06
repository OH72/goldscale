package com.goldscale.model;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@Getter
@Setter
@Document("settings")
public class Settings {

    public static final String GLOBAL_ID = "global";

    @Id
    private String id = GLOBAL_ID;

    private Currency displayCurrency = Currency.UAH;

    private LocalDate initialDate = LocalDate.of(2022, 1, 1);

    private Map<String, Long> exchangeRates = new HashMap<>();

    @LastModifiedDate
    private Instant updatedAt;
}
