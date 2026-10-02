package com.goldscale.service;

import com.goldscale.model.Account;
import com.goldscale.model.TransactionType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class BalanceService {

    private final MongoTemplate mongoTemplate;

    public long calculateDelta(TransactionType type, long amount) {
        return switch (type) {
            case INCOME, INITIAL_BALANCE -> amount;
            case EXPENSE -> -amount;
            case TRANSFER -> throw new IllegalArgumentException("Use transfer-specific logic");
        };
    }

    public void adjustBalance(String accountId, long delta) {
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(accountId)),
                new Update().inc("balance", delta).set("updatedAt", Instant.now()),
                Account.class
        );
    }
}
