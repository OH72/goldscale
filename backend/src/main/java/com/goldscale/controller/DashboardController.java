package com.goldscale.controller;

import com.goldscale.dto.response.CategoryExpenseResponse;
import com.goldscale.dto.response.DashboardResponse;
import com.goldscale.dto.response.ExpenseTrendResponse;
import com.goldscale.dto.response.IncomeVsExpenseResult;
import com.goldscale.model.TransactionType;
import com.goldscale.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping
    public ResponseEntity<DashboardResponse> getDashboard() {
        return ResponseEntity.ok(dashboardService.getDashboard());
    }

    @GetMapping("/expenses-by-category")
    public ResponseEntity<List<CategoryExpenseResponse>> getExpensesByCategory(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @RequestParam(required = false) List<String> accountIds,
            @RequestParam(required = false) List<String> categoryIds,
            @RequestParam(required = false) List<String> tagIds,
            @RequestParam(required = false) List<TransactionType> types) {
        return ResponseEntity.ok(dashboardService.getExpensesByCategory(from, to, accountIds, categoryIds, tagIds, types));
    }

    @GetMapping("/income-vs-expenses")
    public ResponseEntity<IncomeVsExpenseResult> getIncomeVsExpenses(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @RequestParam(required = false) List<String> accountIds,
            @RequestParam(required = false) List<String> categoryIds,
            @RequestParam(required = false) List<String> tagIds,
            @RequestParam(required = false) List<TransactionType> types) {
        return ResponseEntity.ok(dashboardService.getIncomeVsExpenses(from, to, accountIds, categoryIds, tagIds, types));
    }

    @GetMapping("/expense-trend")
    public ResponseEntity<List<ExpenseTrendResponse>> getExpenseTrend(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @RequestParam(required = false) List<String> accountIds,
            @RequestParam(required = false) List<String> categoryIds,
            @RequestParam(required = false) List<String> tagIds,
            @RequestParam(required = false) List<TransactionType> types) {
        return ResponseEntity.ok(dashboardService.getExpenseTrend(from, to, accountIds, categoryIds, tagIds, types));
    }
}
