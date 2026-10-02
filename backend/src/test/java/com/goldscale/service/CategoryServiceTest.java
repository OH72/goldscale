package com.goldscale.service;

import com.goldscale.dto.request.CreateCategoryRequest;
import com.goldscale.dto.request.UpdateCategoryRequest;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.Category;
import com.goldscale.model.CategoryType;
import com.goldscale.repository.CategoryRepository;
import com.goldscale.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CategoryServiceTest {

    @Mock private CategoryRepository categoryRepository;
    @Mock private TransactionRepository transactionRepository;

    @InjectMocks private CategoryService categoryService;

    @Test
    void should_createCategory_when_validRequest() {
        var request = new CreateCategoryRequest("Food", CategoryType.EXPENSE, "utensils");
        var saved = new Category();
        saved.setId("cat-1");
        saved.setName("Food");
        saved.setType(CategoryType.EXPENSE);

        when(categoryRepository.existsByNameAndType("Food", CategoryType.EXPENSE)).thenReturn(false);
        when(categoryRepository.save(any())).thenReturn(saved);

        var result = categoryService.create(request);

        assertThat(result.getName()).isEqualTo("Food");
        verify(categoryRepository).save(any());
    }

    @Test
    void should_throwBusinessRule_when_duplicateNameAndType() {
        var request = new CreateCategoryRequest("Food", CategoryType.EXPENSE, null);
        when(categoryRepository.existsByNameAndType("Food", CategoryType.EXPENSE)).thenReturn(true);

        assertThatThrownBy(() -> categoryService.create(request))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void should_throwNotFound_when_categoryDoesNotExist() {
        when(categoryRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> categoryService.findById("missing"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void should_throwBusinessRule_when_deletingCategoryWithTransactions() {
        var category = new Category();
        category.setId("cat-1");
        category.setName("Food");

        when(categoryRepository.findById("cat-1")).thenReturn(Optional.of(category));
        when(transactionRepository.existsByCategoryIdAndDeletedFalse("cat-1")).thenReturn(true);

        assertThatThrownBy(() -> categoryService.delete("cat-1"))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("active transactions");
    }

    @Test
    void should_deleteCategory_when_noTransactions() {
        var category = new Category();
        category.setId("cat-1");

        when(categoryRepository.findById("cat-1")).thenReturn(Optional.of(category));
        when(transactionRepository.existsByCategoryIdAndDeletedFalse("cat-1")).thenReturn(false);

        categoryService.delete("cat-1");

        verify(categoryRepository).delete(category);
    }

    @Test
    void should_updateName_when_noDuplicate() {
        var category = new Category();
        category.setId("cat-1");
        category.setName("Old");
        category.setType(CategoryType.EXPENSE);

        when(categoryRepository.findById("cat-1")).thenReturn(Optional.of(category));
        when(categoryRepository.existsByNameAndType("New", CategoryType.EXPENSE)).thenReturn(false);
        when(categoryRepository.save(any())).thenReturn(category);

        var result = categoryService.update("cat-1", new UpdateCategoryRequest("New", null));

        assertThat(result.getName()).isEqualTo("New");
    }
}
