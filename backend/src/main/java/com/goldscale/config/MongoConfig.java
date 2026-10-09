package com.goldscale.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.MongoTemplate;

@Slf4j
@Configuration
@EnableMongoAuditing
public class MongoConfig {

    private final MongoTemplate mongoTemplate;

    public MongoConfig(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Bean
    public MongoTransactionManager transactionManager(MongoDatabaseFactory dbFactory) {
        return new MongoTransactionManager(dbFactory);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void migrateIndexes() {
        var collection = mongoTemplate.getCollection("categories");
        for (var index : collection.listIndexes()) {
            if ("name_type_idx".equals(index.getString("name"))) {
                collection.dropIndex("name_type_idx");
                log.info("Dropped legacy name_type_idx index from categories collection");
                break;
            }
        }
    }
}
