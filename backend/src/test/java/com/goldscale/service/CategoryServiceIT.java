package com.goldscale.service;

import com.goldscale.config.TestcontainersConfig;
import com.goldscale.dto.request.CreateAccountRequest;
import com.goldscale.dto.request.CreateCategoryRequest;
import com.goldscale.dto.request.TransactionCommand.CreateExpense;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.model.CategoryType;
import com.goldscale.model.Currency;
import com.goldscale.repository.AccountRepository;
import com.goldscale.repository.CategoryRepository;
import com.goldscale.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfig.class)
class CategoryServiceIT {

    @Autowired private CategoryService categoryService;
    @Autowired private AccountService accountService;
    @Autowired private TransactionService transactionService;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private AccountRepository accountRepository;
    @Autowired private TransactionRepository transactionRepository;

    @BeforeEach
    void cleanUp() {
        transactionRepository.deleteAll();
        accountRepository.deleteAll();
        categoryRepository.deleteAll();
    }

    @Test
    void should_persistCategory_when_created() {
        var category = categoryService.create(
                new CreateCategoryRequest("Salary", CategoryType.INCOME, "briefcase"));

        var saved = categoryRepository.findById(category.getId()).orElseThrow();
        assertThat(saved.getName()).isEqualTo("Salary");
        assertThat(saved.getType()).isEqualTo(CategoryType.INCOME);
        assertThat(saved.getIcon()).isEqualTo("briefcase");
    }

    @Test
    void should_rejectDuplicateName_when_created() {
        categoryService.create(new CreateCategoryRequest("Other", CategoryType.INCOME, null));

        assertThatThrownBy(() -> categoryService.create(
                new CreateCategoryRequest("Other", CategoryType.EXPENSE, null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void should_deleteCategory_when_noTransactionsReference() {
        var category = categoryService.create(
                new CreateCategoryRequest("Unused", CategoryType.EXPENSE, null));

        categoryService.delete(category.getId());

        assertThat(categoryRepository.findById(category.getId())).isEmpty();
    }

    @Test
    void should_preventDeletion_when_activeTransactionsExist() {
        var category = categoryService.create(
                new CreateCategoryRequest("Food", CategoryType.EXPENSE, null));
        var account = accountService.create(
                new CreateAccountRequest("Test Account", Currency.UAH, 1000000L));

        transactionService.create(new CreateExpense(
                account.getId(), 50000L, category.getId(), LocalDate.now(), "lunch"));

        assertThatThrownBy(() -> categoryService.delete(category.getId()))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("active transactions");
    }

    @Test
    void should_allowDeletion_when_onlySoftDeletedTransactionsExist() {
        var category = categoryService.create(
                new CreateCategoryRequest("Temp", CategoryType.EXPENSE, null));
        var account = accountService.create(
                new CreateAccountRequest("Test", Currency.UAH, 1000000L));

        var txn = transactionService.create(new CreateExpense(
                account.getId(), 10000L, category.getId(), LocalDate.now(), "test"));
        transactionService.delete(txn.id());

        categoryService.delete(category.getId());

        assertThat(categoryRepository.findById(category.getId())).isEmpty();
    }
}
