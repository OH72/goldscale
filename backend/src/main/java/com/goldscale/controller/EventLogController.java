package com.goldscale.controller;

import com.goldscale.dto.response.EventLogResponse;
import com.goldscale.service.EventLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class EventLogController {

    private final EventLogService eventLogService;

    @GetMapping
    public ResponseEntity<Page<EventLogResponse>> findAll(
            @RequestParam(required = false) String entityType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(eventLogService.findAll(entityType, page, size));
    }
}
