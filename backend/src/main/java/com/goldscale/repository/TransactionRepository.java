package com.goldscale.repository;

import com.goldscale.model.Transaction;
import com.goldscale.model.TransactionType;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TransactionRepository extends MongoRepository<Transaction, String> {

    List<Transaction> findByAccountIdAndDeletedFalse(String accountId);

    Optional<Transaction> findByIdAndDeletedFalse(String id);

    Optional<Transaction> findByAccountIdAndTypeAndDeletedFalse(String accountId, TransactionType type);

    boolean existsByCategoryIdAndDeletedFalse(String categoryId);

    long countByAccountIdAndDeletedFalse(String accountId);

    long countByTargetAccountIdAndDeletedFalse(String targetAccountId);
}
