package com.goldscale.repository;

import com.goldscale.model.ExchangeRate;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ExchangeRateRepository extends MongoRepository<ExchangeRate, String> {
}
