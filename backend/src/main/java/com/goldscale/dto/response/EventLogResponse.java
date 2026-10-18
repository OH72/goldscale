package com.goldscale.dto.response;

import com.goldscale.model.EventLog;

import java.time.Instant;

public record EventLogResponse(
        String id,
        String action,
        String entityType,
        String entityId,
        String description,
        Instant timestamp
) {
    public static EventLogResponse from(EventLog log) {
        return new EventLogResponse(
                log.getId(), log.getAction(), log.getEntityType(),
                log.getEntityId(), log.getDescription(), log.getTimestamp()
        );
    }
}
