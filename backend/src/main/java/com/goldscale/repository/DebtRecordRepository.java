package com.goldscale.repository;

import com.goldscale.model.DebtRecord;
import com.goldscale.model.DebtStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface DebtRecordRepository extends MongoRepository<DebtRecord, String> {
    List<DebtRecord> findByDeletedFalse();
    Optional<DebtRecord> findByIdAndDeletedFalse(String id);
    boolean existsByPersonIdAndStatusAndDeletedFalse(String personId, DebtStatus status);
    List<DebtRecord> findByPersonIdAndDeletedFalse(String personId);
}
