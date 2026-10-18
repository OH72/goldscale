package com.goldscale.service;

import com.goldscale.dto.request.UpdateSettingsRequest;
import com.goldscale.model.Settings;
import com.goldscale.repository.SettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SettingsService {

    private final SettingsRepository settingsRepository;
    private final EventLogService eventLogService;

    public Settings get() {
        return settingsRepository.findById(Settings.GLOBAL_ID)
                .orElseGet(() -> settingsRepository.save(new Settings()));
    }

    public Settings update(UpdateSettingsRequest request) {
        var settings = get();
        if (request.displayCurrency() != null) {
            settings.setDisplayCurrency(request.displayCurrency());
        }
        if (request.initialDate() != null) {
            settings.setInitialDate(request.initialDate());
        }
        settings = settingsRepository.save(settings);
        eventLogService.log("UPDATE", "SETTINGS", null, "Updated settings");
        return settings;
    }
}
