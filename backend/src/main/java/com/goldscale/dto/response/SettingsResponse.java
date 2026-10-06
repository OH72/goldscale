package com.goldscale.dto.response;

import com.goldscale.model.Currency;
import com.goldscale.model.Settings;

import java.time.LocalDate;

public record SettingsResponse(
        Currency displayCurrency,
        LocalDate initialDate
) {
    public static SettingsResponse from(Settings settings) {
        return new SettingsResponse(settings.getDisplayCurrency(), settings.getInitialDate());
    }
}
