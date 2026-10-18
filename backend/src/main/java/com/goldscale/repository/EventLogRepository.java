package com.goldscale.repository;

import com.goldscale.model.EventLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface EventLogRepository extends MongoRepository<EventLog, String> {

    Page<EventLog> findByEntityType(String entityType, Pageable pageable);
}
