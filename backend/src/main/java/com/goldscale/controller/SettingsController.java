package com.goldscale.controller;

import com.goldscale.dto.request.UpdateSettingsRequest;
import com.goldscale.dto.response.SettingsResponse;
import com.goldscale.service.SettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService settingsService;

    @GetMapping
    public ResponseEntity<SettingsResponse> get() {
        return ResponseEntity.ok(SettingsResponse.from(settingsService.get()));
    }

    @PutMapping
    public ResponseEntity<SettingsResponse> update(@Valid @RequestBody UpdateSettingsRequest request) {
        return ResponseEntity.ok(SettingsResponse.from(settingsService.update(request)));
    }
}
