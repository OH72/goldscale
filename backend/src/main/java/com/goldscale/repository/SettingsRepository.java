package com.goldscale.repository;

import com.goldscale.model.Settings;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface SettingsRepository extends MongoRepository<Settings, String> {
}
