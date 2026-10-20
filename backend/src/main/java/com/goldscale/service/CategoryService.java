package com.goldscale.service;

import com.goldscale.dto.request.CreateCategoryRequest;
import com.goldscale.dto.request.UpdateCategoryRequest;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.Category;
import com.goldscale.model.CategoryType;
import com.goldscale.repository.CategoryRepository;
import com.goldscale.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;
    private final EventLogService eventLogService;
    private final MongoTemplate mongoTemplate;

    public List<Category> findAll() {
        return categoryRepository.findAll();
    }

    public Category findById(String id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }

    public Category create(CreateCategoryRequest request) {
        if (categoryRepository.existsByName(request.name())) {
            throw new BusinessRuleException(
                    "Category '" + request.name() + "' already exists");
        }

        var category = new Category();
        category.setName(request.name());
        category.setType(request.type());
        category.setIcon(request.icon());
        category = categoryRepository.save(category);
        eventLogService.log("CREATE", "CATEGORY", category.getId(), "Created category '" + category.getName() + "'");
        return category;
    }

    public Category update(String id, UpdateCategoryRequest request) {
        var category = findById(id);

        if (!category.getName().equals(request.name())
                && categoryRepository.existsByName(request.name())) {
            throw new BusinessRuleException(
                    "Category '" + request.name() + "' already exists");
        }

        category.setName(request.name());
        category.setType(request.type());
        category.setIcon(request.icon());
        category = categoryRepository.save(category);
        eventLogService.log("UPDATE", "CATEGORY", category.getId(), "Updated category '" + category.getName() + "'");
        return category;
    }

    public void delete(String id) {
        var category = findById(id);

        if (transactionRepository.existsByCategoryIdAndDeletedFalse(id)) {
            throw new BusinessRuleException(
                    "Cannot delete category '" + category.getName() + "': it has active transactions");
        }

        categoryRepository.delete(category);
        eventLogService.log("DELETE", "CATEGORY", id, "Deleted category '" + category.getName() + "'");
    }

    public void merge(String sourceId, String targetId) {
        if (sourceId.equals(targetId)) {
            throw new BusinessRuleException("Cannot merge a category into itself");
        }
        var source = findById(sourceId);
        var target = findById(targetId);

        // Widen target type if source has a different type
        if (source.getType() != target.getType() && target.getType() != CategoryType.BOTH) {
            target.setType(CategoryType.BOTH);
            target = categoryRepository.save(target);
        }

        // Update transactions: source → target
        mongoTemplate.updateMulti(
                Query.query(Criteria.where("categoryId").is(sourceId).and("deleted").is(false)),
                Update.update("categoryId", targetId),
                "transactions"
        );

        // Update debt records: source → target
        mongoTemplate.updateMulti(
                Query.query(Criteria.where("categoryId").is(sourceId)),
                Update.update("categoryId", targetId),
                "debt_records"
        );

        categoryRepository.delete(source);
        eventLogService.log("DELETE", "CATEGORY", sourceId,
                "Merged category '" + source.getName() + "' into '" + target.getName() + "'");
    }

    public void bulkDelete(List<String> ids) {
        var categories = categoryRepository.findAllById(ids);

        var inUse = new ArrayList<String>();
        for (var category : categories) {
            if (transactionRepository.existsByCategoryIdAndDeletedFalse(category.getId())) {
                inUse.add(category.getName());
            }
        }

        if (!inUse.isEmpty()) {
            throw new BusinessRuleException(
                    "Cannot delete: the following categories have active transactions: " + String.join(", ", inUse));
        }

        categoryRepository.deleteAll(categories);
        var names = categories.stream().map(Category::getName).toList();
        eventLogService.log("DELETE", "CATEGORY", null, "Bulk deleted categories: " + String.join(", ", names));
    }
}
