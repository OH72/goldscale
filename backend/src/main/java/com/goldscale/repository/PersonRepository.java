package com.goldscale.repository;

import com.goldscale.model.Person;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface PersonRepository extends MongoRepository<Person, String> {
    boolean existsByName(String name);
}
