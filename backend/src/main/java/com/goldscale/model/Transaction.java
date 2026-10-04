package com.goldscale.model;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@Document("transactions")
@CompoundIndexes({
        @CompoundIndex(name = "account_date_idx", def = "{'accountId': 1, 'date': -1}"),
        @CompoundIndex(name = "target_account_date_idx", def = "{'targetAccountId': 1, 'date': -1}"),
        @CompoundIndex(name = "account_type_idx", def = "{'accountId': 1, 'type': 1}"),
        @CompoundIndex(name = "date_idx", def = "{'date': -1}")
})
public class Transaction {

    @Id
    private String id;

    private TransactionType type;

    private String accountId;

    private String targetAccountId;

    @Indexed
    private String categoryId;

    private long amount;

    private Long targetAmount;

    private Double exchangeRate;

    private String description;

    private LocalDate date;

    private List<String> tags;

    private boolean deleted;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
