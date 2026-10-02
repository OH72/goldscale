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
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;

    public List<Category> findAll(CategoryType type) {
        if (type != null) {
            return categoryRepository.findByType(type);
        }
        return categoryRepository.findAll();
    }

    public Category findById(String id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }

    public Category create(CreateCategoryRequest request) {
        if (categoryRepository.existsByNameAndType(request.name(), request.type())) {
            throw new BusinessRuleException(
                    "Category '" + request.name() + "' of type " + request.type() + " already exists");
        }

        var category = new Category();
        category.setName(request.name());
        category.setType(request.type());
        category.setIcon(request.icon());
        return categoryRepository.save(category);
    }

    public Category update(String id, UpdateCategoryRequest request) {
        var category = findById(id);

        if (!category.getName().equals(request.name())
                && categoryRepository.existsByNameAndType(request.name(), category.getType())) {
            throw new BusinessRuleException(
                    "Category '" + request.name() + "' of type " + category.getType() + " already exists");
        }

        category.setName(request.name());
        category.setIcon(request.icon());
        return categoryRepository.save(category);
    }

    public void delete(String id) {
        var category = findById(id);

        if (transactionRepository.existsByCategoryIdAndDeletedFalse(id)) {
            throw new BusinessRuleException(
                    "Cannot delete category '" + category.getName() + "': it has active transactions");
        }

        categoryRepository.delete(category);
    }
}
