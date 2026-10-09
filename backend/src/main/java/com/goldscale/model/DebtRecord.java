package com.goldscale.model;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@Document("debtRecords")
@CompoundIndex(name = "personId_deleted", def = "{'personId': 1, 'deleted': 1}")
public class DebtRecord {
    @Id
    private String id;
    private String personId;
    private DebtType type;
    private long amount;
    private long coveredAmount;
    private Currency currency;
    private String categoryId;
    private List<String> tagIds;
    private String description;
    private LocalDate date;
    private DebtStatus status;
    private List<Payment> payments;
    private boolean deleted;
    @CreatedDate
    private Instant createdAt;
    private Instant updatedAt;
}
