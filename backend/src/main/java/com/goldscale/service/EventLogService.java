package com.goldscale.service;

import com.goldscale.dto.response.EventLogResponse;
import com.goldscale.model.EventLog;
import com.goldscale.repository.EventLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.support.PageableExecutionUtils;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class EventLogService {

    private final EventLogRepository eventLogRepository;
    private final MongoTemplate mongoTemplate;

    public void log(String action, String entityType, String entityId, String description) {
        var entry = new EventLog();
        entry.setAction(action);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setDescription(description);
        entry.setTimestamp(Instant.now());
        eventLogRepository.save(entry);
    }

    public Page<EventLogResponse> findAll(String entityType, LocalDate startDate, LocalDate endDate, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"));
        var criteria = new Criteria();

        if (entityType != null && !entityType.isBlank()) {
            criteria = criteria.and("entityType").is(entityType);
        }
        if (startDate != null && endDate != null) {
            criteria = criteria.and("timestamp")
                    .gte(startDate.atStartOfDay(ZoneOffset.UTC).toInstant())
                    .lte(endDate.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant());
        } else if (startDate != null) {
            criteria = criteria.and("timestamp").gte(startDate.atStartOfDay(ZoneOffset.UTC).toInstant());
        } else if (endDate != null) {
            criteria = criteria.and("timestamp").lte(endDate.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant());
        }

        var query = new Query(criteria).with(pageable);
        var logs = mongoTemplate.find(query, EventLog.class);
        return PageableExecutionUtils.getPage(
                logs.stream().map(EventLogResponse::from).toList(),
                pageable,
                () -> mongoTemplate.count(Query.of(query).limit(-1).skip(-1), EventLog.class)
        );
    }
}
