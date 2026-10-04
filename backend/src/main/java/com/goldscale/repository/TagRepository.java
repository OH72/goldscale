package com.goldscale.repository;

import com.goldscale.model.Tag;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TagRepository extends MongoRepository<Tag, String> {
    Optional<Tag> findByName(String name);
    List<Tag> findByNameIn(List<String> names);
    boolean existsByName(String name);
}
