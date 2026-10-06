package com.goldscale.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.goldscale.dto.response.ExchangeRateHistoryResponse;
import com.goldscale.model.Currency;
import com.goldscale.model.ExchangeRate;
import com.goldscale.repository.ExchangeRateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class ExchangeRateService {

    private final ExchangeRateRepository repository;
    private final MongoTemplate mongoTemplate;
    private final SettingsService settingsService;

    private static final RestClient REST_CLIENT = RestClient.create();
    private static final String NBU_API = "https://bank.gov.ua/NBU_Exchange/exchange_site";
    private static final Set<String> FETCH_CURRENCIES = Set.of("USD", "EUR", "PLN", "GBP");
    private static final DateTimeFormatter NBU_DATE_FORMAT = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final Set<String> APP_CURRENCIES = Arrays.stream(Currency.values())
            .map(Enum::name).collect(Collectors.toUnmodifiableSet());
    private static final long RATE_SCALE = 1_000_000L;

    /**
     * Ensure exchange rates exist in DB for the given date range.
     * Fetches from NBU API if coverage is insufficient.
     */
    public void ensureRatesExist(LocalDate from, LocalDate to) {
        LocalDate effectiveTo = to.isAfter(LocalDate.now()) ? LocalDate.now() : to;
        if (from.isAfter(effectiveTo)) return;
        syncFromNbu(from, effectiveTo);
    }

    /**
     * Load historical rates for a date range. Returns a TreeMap keyed by date
     * so callers can use floorEntry() for nearest-date lookup.
     * Loads 7 extra days before {@code from} to handle weekend/holiday gaps.
     */
    public TreeMap<LocalDate, Map<String, Long>> getRatesForRange(LocalDate from, LocalDate to) {
        LocalDate lookupFrom = from.minusDays(7);
        var rates = mongoTemplate.find(
                Query.query(Criteria.where("_id").gte(lookupFrom.toString()).lte(to.toString()))
                        .with(Sort.by(Sort.Direction.ASC, "_id")),
                ExchangeRate.class);

        var map = new TreeMap<LocalDate, Map<String, Long>>();
        for (var rate : rates) {
            map.put(LocalDate.parse(rate.getId()), rate.getRates());
        }
        return map;
    }

    /**
     * Fetch latest rates and convert to Settings-compatible format
     * (subunits of displayCurrency per 1 unit of source currency).
     */
    public Map<String, Long> getLatestForSettings() {
        var settings = settingsService.get();
        Currency displayCurrency = settings.getDisplayCurrency();

        LocalDate today = LocalDate.now();
        ensureRatesExist(today.minusDays(7), today.plusDays(1));

        var ratesMap = getRatesForRange(today.minusDays(7), today.plusDays(1));
        var entry = ratesMap.lastEntry();
        if (entry == null) return Map.of();

        return convertToDisplayFormat(entry.getValue(), displayCurrency);
    }

    /**
     * Return daily exchange rates for the given range, converted to displayCurrency format.
     */
    public List<ExchangeRateHistoryResponse> getHistory(LocalDate from, LocalDate to) {
        var settings = settingsService.get();
        Currency displayCurrency = settings.getDisplayCurrency();

        ensureRatesExist(from, to);
        var ratesMap = getRatesForRange(from, to);

        List<ExchangeRateHistoryResponse> result = new ArrayList<>();
        for (var entry : ratesMap.entrySet()) {
            if (entry.getKey().isBefore(from)) continue;
            var displayRates = convertToDisplayFormat(entry.getValue(), displayCurrency);
            if (!displayRates.isEmpty()) {
                result.add(new ExchangeRateHistoryResponse(entry.getKey().toString(), displayRates));
            }
        }
        return result;
    }

    // ---- internal ----

    private void syncFromNbu(LocalDate from, LocalDate to) {
        Set<String> existingDates = mongoTemplate.find(
                Query.query(Criteria.where("_id").gte(from.toString()).lte(to.toString())),
                ExchangeRate.class
        ).stream().map(ExchangeRate::getId).collect(Collectors.toSet());

        long daysBetween = ChronoUnit.DAYS.between(from, to) + 1;
        long threshold = Math.max(1, daysBetween * 5 / 7 - 2);
        if (existingDates.size() >= threshold) return;

        // Fetch raw NBU rates (UAH-based) for each currency
        Map<LocalDate, Map<String, Double>> rawRates = new HashMap<>();
        for (String currency : FETCH_CURRENCIES) {
            for (NbuRate nr : fetchNbuRange(currency, from, to)) {
                LocalDate date = LocalDate.parse(nr.exchangedate(), NBU_DATE_FORMAT);
                rawRates.computeIfAbsent(date, k -> new HashMap<>())
                        .put(nr.cc(), nr.rate());
            }
        }

        // Convert to USD-based: all rates relative to 1 USD = RATE_SCALE
        Map<LocalDate, Map<String, Long>> ratesByDate = new HashMap<>();
        for (var entry : rawRates.entrySet()) {
            var raw = entry.getValue();
            Double usdNbuRate = raw.get("USD");
            if (usdNbuRate == null || usdNbuRate == 0) continue;

            Map<String, Long> converted = new HashMap<>();
            converted.put("USD", RATE_SCALE);
            converted.put("USDT", RATE_SCALE);
            converted.put("UAH", Math.round(1.0 / usdNbuRate * RATE_SCALE));

            for (var re : raw.entrySet()) {
                if (!"USD".equals(re.getKey())) {
                    converted.put(re.getKey(), Math.round(re.getValue() / usdNbuRate * RATE_SCALE));
                }
            }

            ratesByDate.put(entry.getKey(), converted);
        }

        List<ExchangeRate> toSave = new ArrayList<>();
        for (var e : ratesByDate.entrySet()) {
            if (!existingDates.contains(e.getKey().toString())) {
                var er = new ExchangeRate();
                er.setId(e.getKey().toString());
                er.setRates(e.getValue());
                toSave.add(er);
            }
        }

        if (!toSave.isEmpty()) {
            repository.saveAll(toSave);
            log.info("Synced {} exchange rate entries from NBU", toSave.size());
        }
    }

    private List<NbuRate> fetchNbuRange(String currencyCode, LocalDate from, LocalDate to) {
        String start = from.format(DateTimeFormatter.BASIC_ISO_DATE);
        String end = to.format(DateTimeFormatter.BASIC_ISO_DATE);
        try {
            var result = REST_CLIENT.get()
                    .uri(NBU_API + "?valcode={code}&start={start}&end={end}&sort=exchangedate&order=asc&json",
                            currencyCode, start, end)
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<NbuRate>>() {});
            return result != null ? result : List.of();
        } catch (Exception e) {
            log.warn("Failed to fetch {} rates from NBU: {}", currencyCode, e.getMessage());
            return List.of();
        }
    }

    /**
     * Convert internal USD-based rates to Settings-compatible format:
     * subunits (×100) of displayCurrency per 1 whole unit of source currency.
     */
    private Map<String, Long> convertToDisplayFormat(Map<String, Long> rates, Currency displayCurrency) {
        Long displayRate = rates.get(displayCurrency.name());
        if (displayRate == null || displayRate == 0) return Map.of();

        Map<String, Long> result = new HashMap<>();
        for (var e : rates.entrySet()) {
            if (e.getKey().equals(displayCurrency.name()) || !APP_CURRENCIES.contains(e.getKey())) continue;
            result.put(e.getKey(), Math.round((double) e.getValue() * 100 / displayRate));
        }
        return result;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record NbuRate(int r030, String txt, double rate, String cc, String exchangedate) {}
}
