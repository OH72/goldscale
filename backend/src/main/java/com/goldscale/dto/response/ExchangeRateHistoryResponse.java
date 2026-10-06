package com.goldscale.dto.response;

import java.util.Map;

public record ExchangeRateHistoryResponse(String date, Map<String, Long> rates) {}
