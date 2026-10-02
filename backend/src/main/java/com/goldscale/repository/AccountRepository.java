package com.goldscale.repository;

import com.goldscale.model.Account;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface AccountRepository extends MongoRepository<Account, String> {

    Optional<Account> findByName(String name);

    boolean existsByName(String name);
}
