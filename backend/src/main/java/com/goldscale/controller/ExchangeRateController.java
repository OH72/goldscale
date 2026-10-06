package com.goldscale.controller;

import com.goldscale.dto.response.ExchangeRateHistoryResponse;
import com.goldscale.service.ExchangeRateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/exchange-rates")
@RequiredArgsConstructor
public class ExchangeRateController {

    private final ExchangeRateService exchangeRateService;

    @GetMapping("/latest")
    public ResponseEntity<Map<String, Long>> getLatest() {
        return ResponseEntity.ok(exchangeRateService.getLatestForSettings());
    }

    @GetMapping("/history")
    public ResponseEntity<List<ExchangeRateHistoryResponse>> getHistory(
            @RequestParam LocalDate from, @RequestParam LocalDate to) {
        return ResponseEntity.ok(exchangeRateService.getHistory(from, to));
    }
}
