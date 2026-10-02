package com.goldscale.repository;

import com.goldscale.model.Category;
import com.goldscale.model.CategoryType;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface CategoryRepository extends MongoRepository<Category, String> {

    List<Category> findByType(CategoryType type);

    boolean existsByNameAndType(String name, CategoryType type);
}
