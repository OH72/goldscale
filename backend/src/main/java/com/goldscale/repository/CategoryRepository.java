package com.goldscale.repository;

import com.goldscale.model.Category;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface CategoryRepository extends MongoRepository<Category, String> {

    boolean existsByName(String name);
}
