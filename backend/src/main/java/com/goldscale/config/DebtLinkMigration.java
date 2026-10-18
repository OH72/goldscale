package com.goldscale.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DebtLinkMigration {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    void migrate() {
        var query = new Query(Criteria.where("debtRecordId").exists(true));
        var docs = mongoTemplate.find(query, Document.class, "transactions");

        if (docs.isEmpty()) {
            return;
        }

        log.info("Migrating {} transactions from debtRecordId/paymentId to debtLinks", docs.size());

        for (var doc : docs) {
            var txnId = doc.getObjectId("_id").toHexString();
            var debtRecordId = doc.getString("debtRecordId");
            var paymentId = doc.getString("paymentId");
            var amount = doc.get("amount", Number.class).longValue();

            var link = new Document();
            link.put("debtRecordId", debtRecordId);
            link.put("paymentId", paymentId);
            link.put("amount", amount);

            var update = new Update()
                    .set("debtLinks", List.of(link))
                    .unset("debtRecordId")
                    .unset("paymentId");

            mongoTemplate.updateFirst(
                    new Query(Criteria.where("_id").is(doc.getObjectId("_id"))),
                    update,
                    "transactions"
            );

            // For UC2/UC3 (paymentId is null), set sourceTransactionId on the debt record
            if (paymentId == null && debtRecordId != null) {
                mongoTemplate.updateFirst(
                        new Query(Criteria.where("_id").is(debtRecordId)),
                        new Update().set("sourceTransactionId", txnId),
                        "debtRecords"
                );
            }
        }

        log.info("Migration complete");
    }
}
