package com.goldscale.service;

import com.goldscale.dto.response.AuditResponse;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.Account;
import com.goldscale.model.Transaction;
import com.goldscale.model.TransactionType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

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

    @Transactional
    public AuditResponse audit(String accountId) {
        var account = mongoTemplate.findById(accountId, Account.class);
        if (account == null) {
            throw new ResourceNotFoundException("Account", accountId);
        }

        long storedBalance = account.getBalance();

        // Sum transactions where this account is the source (accountId)
        var asSource = mongoTemplate.find(
                Query.query(Criteria.where("accountId").is(accountId).and("deleted").ne(true)),
                Transaction.class);

        long calculated = 0;
        for (var txn : asSource) {
            calculated += switch (txn.getType()) {
                case INCOME, INITIAL_BALANCE -> txn.getAmount();
                case EXPENSE -> -txn.getAmount();
                case TRANSFER -> -txn.getAmount();
            };
        }

        // Sum transactions where this account is the transfer target (targetAccountId)
        var asTarget = mongoTemplate.find(
                Query.query(Criteria.where("targetAccountId").is(accountId)
                        .and("deleted").ne(true)
                        .and("type").is(TransactionType.TRANSFER)),
                Transaction.class);

        for (var txn : asTarget) {
            calculated += txn.getTargetAmount();
        }

        boolean match = storedBalance == calculated;
        if (!match) {
            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").is(accountId)),
                    new Update().set("balance", calculated).set("updatedAt", Instant.now()),
                    Account.class);
        }

        return new AuditResponse(accountId, storedBalance, calculated, match);
    }
}
