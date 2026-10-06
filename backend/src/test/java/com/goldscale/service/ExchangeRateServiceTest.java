package com.goldscale.service;

import com.goldscale.model.Currency;
import com.goldscale.model.ExchangeRate;
import com.goldscale.repository.ExchangeRateRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExchangeRateServiceTest {

    @Mock private ExchangeRateRepository repository;
    @Mock private MongoTemplate mongoTemplate;
    @Mock private SettingsService settingsService;

    private static final Map<String, Long> RATES = Map.of("USD", 1_000_000L, "UAH", 25_000L, "GBP", 0L);

    private ExchangeRateService service() {
        return new ExchangeRateService(repository, mongoTemplate, settingsService);
    }

    @Test
    void should_convertAmount_when_ratesPresent() {
        var result = service().convertWithRates(1000L, Currency.USD, Currency.UAH, RATES);

        assertThat(result).hasValue(40_000L);
    }

    @Test
    void should_truncateResult_when_divisionIsNotExact() {
        var result = service().convertWithRates(1L, Currency.UAH, Currency.USD, RATES);

        assertThat(result).hasValue(0L);
    }

    @Test
    void should_returnEmpty_when_rateMissing() {
        var result = service().convertWithRates(1000L, Currency.PLN, Currency.UAH, RATES);

        assertThat(result).isEmpty();
    }

    @Test
    void should_returnEmpty_when_rateIsZero() {
        assertThat(service().convertWithRates(1000L, Currency.GBP, Currency.UAH, RATES)).isEmpty();
        assertThat(service().convertWithRates(1000L, Currency.UAH, Currency.GBP, RATES)).isEmpty();
    }

    @Test
    void should_returnSameAmount_when_sameCurrencyEvenWithoutRates() {
        var result = service().convertWithRates(777L, Currency.EUR, Currency.EUR, Map.of());

        assertThat(result).hasValue(777L);
    }

    @Test
    void should_returnLatestRates_when_entriesExist() {
        var older = rate(LocalDate.now().minusDays(2), Map.of("USD", 1_000_000L));
        var latest = rate(LocalDate.now().minusDays(1), RATES);
        when(mongoTemplate.find(any(Query.class), eq(ExchangeRate.class))).thenReturn(List.of(older, latest));
        var service = spy(service());
        doNothing().when(service).ensureRatesExist(any(), any());

        assertThat(service.getLatestRates()).isEqualTo(RATES);
    }

    @Test
    void should_returnEmptyMap_when_noRatesStored() {
        when(mongoTemplate.find(any(Query.class), eq(ExchangeRate.class))).thenReturn(List.of());
        var service = spy(service());
        doNothing().when(service).ensureRatesExist(any(), any());

        assertThat(service.getLatestRates()).isEmpty();
    }

    private ExchangeRate rate(LocalDate date, Map<String, Long> rates) {
        var rate = new ExchangeRate();
        rate.setId(date.toString());
        rate.setRates(rates);
        return rate;
    }
}
