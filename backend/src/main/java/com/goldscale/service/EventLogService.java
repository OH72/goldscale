package com.goldscale.service;

import com.goldscale.dto.response.EventLogResponse;
import com.goldscale.model.EventLog;
import com.goldscale.repository.EventLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class EventLogService {

    private final EventLogRepository eventLogRepository;

    public void log(String action, String entityType, String entityId, String description) {
        var entry = new EventLog();
        entry.setAction(action);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setDescription(description);
        entry.setTimestamp(Instant.now());
        eventLogRepository.save(entry);
    }

    public Page<EventLogResponse> findAll(String entityType, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"));
        Page<EventLog> logs;
        if (entityType != null && !entityType.isBlank()) {
            logs = eventLogRepository.findByEntityType(entityType, pageable);
        } else {
            logs = eventLogRepository.findAll(pageable);
        }
        return logs.map(EventLogResponse::from);
    }
}
