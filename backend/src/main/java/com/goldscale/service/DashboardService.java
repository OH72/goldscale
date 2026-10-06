package com.goldscale.service;

import com.goldscale.dto.response.AccountResponse;
import com.goldscale.dto.response.CategoryExpenseResponse;
import com.goldscale.dto.response.DashboardResponse;
import com.goldscale.dto.response.ExpenseTrendResponse;
import com.goldscale.dto.response.IncomeVsExpenseResponse;
import com.goldscale.dto.response.IncomeVsExpenseResult;
import com.goldscale.dto.response.TransactionResponse;
import com.goldscale.model.Account;
import com.goldscale.model.Currency;
import com.goldscale.model.Settings;
import com.goldscale.model.Transaction;
import com.goldscale.model.TransactionType;
import com.goldscale.repository.AccountRepository;
import com.goldscale.repository.CategoryRepository;
import com.goldscale.repository.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import com.goldscale.model.Tag;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final AccountRepository accountRepository;
    private final CategoryRepository categoryRepository;
    private final TagRepository tagRepository;
    private final SettingsService settingsService;
    private final ExchangeRateService exchangeRateService;
    private final MongoTemplate mongoTemplate;

    public DashboardResponse getDashboard() {
        var allAccounts = accountRepository.findAll();
        var accounts = allAccounts.stream()
                .map(AccountResponse::from)
                .toList();

        var settings = settingsService.get();
        long totalNetWorth = computeNetWorth(allAccounts, settings);

        var query = Query.query(Criteria.where("deleted").ne(true)
                        .and("type").ne(TransactionType.INITIAL_BALANCE))
                .with(Sort.by(Sort.Direction.DESC, "date", "createdAt"))
                .limit(10);

        var recentTxns = mongoTemplate.find(query, Transaction.class);
        var responses = enrichWithNames(recentTxns);

        return new DashboardResponse(accounts, responses, totalNetWorth, settings.getDisplayCurrency());
    }

    private long computeNetWorth(List<Account> accounts, Settings settings) {
        Currency displayCurrency = settings.getDisplayCurrency();
        LocalDate today = LocalDate.now();
        exchangeRateService.ensureRatesExist(today.minusDays(7), today.plusDays(1));
        var ratesMap = exchangeRateService.getRatesForRange(today.minusDays(7), today.plusDays(1));
        var latestEntry = ratesMap.lastEntry();
        Map<String, Long> rates = latestEntry != null ? latestEntry.getValue() : Map.of();

        long total = 0;
        for (var account : accounts) {
            if (!account.isActive()) continue;
            if (account.getCurrency() == displayCurrency) {
                total += account.getBalance();
            } else {
                Long sourceRate = rates.get(account.getCurrency().name());
                Long displayRate = rates.get(displayCurrency.name());
                if (sourceRate != null && sourceRate > 0 && displayRate != null && displayRate > 0) {
                    total += account.getBalance() * sourceRate / displayRate;
                }
            }
        }
        return total;
    }

    public List<CategoryExpenseResponse> getExpensesByCategory(LocalDate from, LocalDate to, List<String> accountIds) {
        var settings = settingsService.get();
        var displayCurrency = settings.getDisplayCurrency();
        exchangeRateService.ensureRatesExist(from, to);
        var historicalRates = exchangeRateService.getRatesForRange(from, to);
        var accountCurrencies = buildAccountCurrencyMap();
        var transactions = fetchTransactions(TransactionType.EXPENSE, from, to, accountIds);

        // Group by categoryId and sum converted amounts
        Map<String, Long> totals = new HashMap<>();
        for (var txn : transactions) {
            long converted = convertAmount(txn.getAmount(), accountCurrencies.get(txn.getAccountId()),
                    displayCurrency, historicalRates, txn.getDate());
            totals.merge(txn.getCategoryId() != null ? txn.getCategoryId() : "uncategorized", converted, Long::sum);
        }

        // Resolve category names
        var categoryNames = totals.keySet().stream()
                .filter(id -> !"uncategorized".equals(id))
                .collect(Collectors.toSet());
        Map<String, String> nameMap = categoryNames.isEmpty()
                ? Map.of()
                : categoryRepository.findAllById(categoryNames).stream()
                        .collect(Collectors.toMap(c -> c.getId(), c -> c.getName()));

        return totals.entrySet().stream()
                .map(e -> new CategoryExpenseResponse(
                        e.getKey(),
                        nameMap.getOrDefault(e.getKey(), "Uncategorized"),
                        e.getValue()))
                .sorted(Comparator.comparingLong(CategoryExpenseResponse::amount).reversed())
                .toList();
    }

    public IncomeVsExpenseResult getIncomeVsExpenses(LocalDate from, LocalDate to, List<String> accountIds) {
        var settings = settingsService.get();
        var displayCurrency = settings.getDisplayCurrency();
        var accountCurrencies = buildAccountCurrencyMap();

        // Compute prior net (all income - expenses before 'from')
        long priorNet = computePriorNet(from, accountIds, displayCurrency, accountCurrencies);

        exchangeRateService.ensureRatesExist(from, to);
        var historicalRates = exchangeRateService.getRatesForRange(from, to);

        var incomes = fetchTransactions(TransactionType.INCOME, from, to, accountIds);
        var expenses = fetchTransactions(TransactionType.EXPENSE, from, to, accountIds);

        // Group by month
        Map<YearMonth, Long> incomeByMonth = new LinkedHashMap<>();
        Map<YearMonth, Long> expenseByMonth = new LinkedHashMap<>();

        for (var txn : incomes) {
            var month = YearMonth.from(txn.getDate());
            long converted = convertAmount(txn.getAmount(), accountCurrencies.get(txn.getAccountId()),
                    displayCurrency, historicalRates, txn.getDate());
            incomeByMonth.merge(month, converted, Long::sum);
        }
        for (var txn : expenses) {
            var month = YearMonth.from(txn.getDate());
            long converted = convertAmount(txn.getAmount(), accountCurrencies.get(txn.getAccountId()),
                    displayCurrency, historicalRates, txn.getDate());
            expenseByMonth.merge(month, converted, Long::sum);
        }

        // Transfers crossing account filter boundary
        if (accountIds != null && !accountIds.isEmpty()) {
            var selectedSet = new HashSet<>(accountIds);
            var transfers = fetchTransfers(from, to, accountIds);
            for (var txn : transfers) {
                var month = YearMonth.from(txn.getDate());
                boolean sourceSelected = selectedSet.contains(txn.getAccountId());
                boolean targetSelected = txn.getTargetAccountId() != null && selectedSet.contains(txn.getTargetAccountId());
                if (sourceSelected && !targetSelected) {
                    long converted = convertAmount(txn.getAmount(), accountCurrencies.get(txn.getAccountId()),
                            displayCurrency, historicalRates, txn.getDate());
                    expenseByMonth.merge(month, converted, Long::sum);
                } else if (!sourceSelected && targetSelected) {
                    long targetAmt = txn.getTargetAmount() != null ? txn.getTargetAmount() : txn.getAmount();
                    long converted = convertAmount(targetAmt, accountCurrencies.get(txn.getTargetAccountId()),
                            displayCurrency, historicalRates, txn.getDate());
                    incomeByMonth.merge(month, converted, Long::sum);
                }
            }
        }

        // Build result for all months in range
        var results = new ArrayList<IncomeVsExpenseResponse>();
        var current = YearMonth.from(from);
        var end = YearMonth.from(to);
        while (!current.isAfter(end)) {
            long inc = incomeByMonth.getOrDefault(current, 0L);
            long exp = expenseByMonth.getOrDefault(current, 0L);
            results.add(new IncomeVsExpenseResponse(current.toString(), inc, exp, inc - exp));
            current = current.plusMonths(1);
        }
        return new IncomeVsExpenseResult(priorNet, results);
    }

    private long computePriorNet(LocalDate before, List<String> accountIds,
                                 Currency displayCurrency, Map<String, Currency> accountCurrencies) {
        var priorIncomes = fetchTransactionsBefore(TransactionType.INCOME, before, accountIds);
        var priorExpenses = fetchTransactionsBefore(TransactionType.EXPENSE, before, accountIds);

        // Use latest rates for all prior conversions (no per-day historical rates for old data)
        LocalDate today = LocalDate.now();
        exchangeRateService.ensureRatesExist(today.minusDays(7), today.plusDays(1));
        var ratesMap = exchangeRateService.getRatesForRange(today.minusDays(7), today.plusDays(1));
        var latestEntry = ratesMap.lastEntry();
        Map<String, Long> rates = latestEntry != null ? latestEntry.getValue() : Map.of();

        long totalIncome = 0;
        for (var txn : priorIncomes) {
            totalIncome += convertAmountWithRates(txn.getAmount(),
                    accountCurrencies.get(txn.getAccountId()), displayCurrency, rates);
        }
        long totalExpense = 0;
        for (var txn : priorExpenses) {
            totalExpense += convertAmountWithRates(txn.getAmount(),
                    accountCurrencies.get(txn.getAccountId()), displayCurrency, rates);
        }

        // Transfers crossing account filter boundary
        if (accountIds != null && !accountIds.isEmpty()) {
            var selectedSet = new HashSet<>(accountIds);
            var transfers = fetchTransfersBefore(before, accountIds);
            for (var txn : transfers) {
                boolean sourceSelected = selectedSet.contains(txn.getAccountId());
                boolean targetSelected = txn.getTargetAccountId() != null && selectedSet.contains(txn.getTargetAccountId());
                if (sourceSelected && !targetSelected) {
                    totalExpense += convertAmountWithRates(txn.getAmount(),
                            accountCurrencies.get(txn.getAccountId()), displayCurrency, rates);
                } else if (!sourceSelected && targetSelected) {
                    long targetAmt = txn.getTargetAmount() != null ? txn.getTargetAmount() : txn.getAmount();
                    totalIncome += convertAmountWithRates(targetAmt,
                            accountCurrencies.get(txn.getTargetAccountId()), displayCurrency, rates);
                }
            }
        }

        return totalIncome - totalExpense;
    }

    private long convertAmountWithRates(long amount, Currency sourceCurrency,
                                        Currency displayCurrency, Map<String, Long> rates) {
        if (sourceCurrency == null || sourceCurrency == displayCurrency) return amount;
        Long sourceRate = rates.get(sourceCurrency.name());
        Long displayRate = rates.get(displayCurrency.name());
        if (sourceRate != null && sourceRate > 0 && displayRate != null && displayRate > 0) {
            return amount * sourceRate / displayRate;
        }
        return amount;
    }

    public List<ExpenseTrendResponse> getExpenseTrend(LocalDate from, LocalDate to, List<String> accountIds) {
        var settings = settingsService.get();
        var displayCurrency = settings.getDisplayCurrency();
        exchangeRateService.ensureRatesExist(from, to);
        var historicalRates = exchangeRateService.getRatesForRange(from, to);
        var accountCurrencies = buildAccountCurrencyMap();
        var transactions = fetchTransactions(TransactionType.EXPENSE, from, to, accountIds);

        // Group by month -> categoryId -> sum
        Map<YearMonth, Map<String, Long>> monthlyTotals = new LinkedHashMap<>();
        for (var txn : transactions) {
            var month = YearMonth.from(txn.getDate());
            long converted = convertAmount(txn.getAmount(), accountCurrencies.get(txn.getAccountId()),
                    displayCurrency, historicalRates, txn.getDate());
            String catId = txn.getCategoryId() != null ? txn.getCategoryId() : "uncategorized";
            monthlyTotals.computeIfAbsent(month, k -> new HashMap<>()).merge(catId, converted, Long::sum);
        }

        // Collect all category IDs for name resolution
        var allCategoryIds = monthlyTotals.values().stream()
                .flatMap(m -> m.keySet().stream())
                .filter(id -> !"uncategorized".equals(id))
                .collect(Collectors.toSet());
        Map<String, String> nameMap = allCategoryIds.isEmpty()
                ? Map.of()
                : categoryRepository.findAllById(allCategoryIds).stream()
                        .collect(Collectors.toMap(c -> c.getId(), c -> c.getName()));

        // Build results for all months in range
        var results = new ArrayList<ExpenseTrendResponse>();
        var current = YearMonth.from(from);
        var end = YearMonth.from(to);
        while (!current.isAfter(end)) {
            var categoryTotals = monthlyTotals.getOrDefault(current, Map.of());
            var categories = categoryTotals.entrySet().stream()
                    .map(e -> new CategoryExpenseResponse(
                            e.getKey(),
                            nameMap.getOrDefault(e.getKey(), "Uncategorized"),
                            e.getValue()))
                    .sorted(Comparator.comparingLong(CategoryExpenseResponse::amount).reversed())
                    .toList();
            results.add(new ExpenseTrendResponse(current.toString(), categories));
            current = current.plusMonths(1);
        }
        return results;
    }

    private List<Transaction> fetchTransactions(TransactionType type, LocalDate from, LocalDate to, List<String> accountIds) {
        var criteria = Criteria.where("deleted").ne(true).and("type").is(type)
                .and("date").gte(from).lte(to);
        if (accountIds != null && !accountIds.isEmpty()) {
            criteria = criteria.and("accountId").in(accountIds);
        }
        return mongoTemplate.find(Query.query(criteria), Transaction.class);
    }

    private List<Transaction> fetchTransactionsBefore(TransactionType type, LocalDate before, List<String> accountIds) {
        var criteria = Criteria.where("deleted").ne(true).and("type").is(type)
                .and("date").lt(before);
        if (accountIds != null && !accountIds.isEmpty()) {
            criteria = criteria.and("accountId").in(accountIds);
        }
        return mongoTemplate.find(Query.query(criteria), Transaction.class);
    }

    private List<Transaction> fetchTransfers(LocalDate from, LocalDate to, List<String> accountIds) {
        return mongoTemplate.find(Query.query(
                Criteria.where("deleted").ne(true).and("type").is(TransactionType.TRANSFER)
                        .and("date").gte(from).lte(to)
                        .andOperator(new Criteria().orOperator(
                                Criteria.where("accountId").in(accountIds),
                                Criteria.where("targetAccountId").in(accountIds)
                        ))
        ), Transaction.class);
    }

    private List<Transaction> fetchTransfersBefore(LocalDate before, List<String> accountIds) {
        return mongoTemplate.find(Query.query(
                Criteria.where("deleted").ne(true).and("type").is(TransactionType.TRANSFER)
                        .and("date").lt(before)
                        .andOperator(new Criteria().orOperator(
                                Criteria.where("accountId").in(accountIds),
                                Criteria.where("targetAccountId").in(accountIds)
                        ))
        ), Transaction.class);
    }

    private Map<String, Currency> buildAccountCurrencyMap() {
        return accountRepository.findAll().stream()
                .collect(Collectors.toMap(Account::getId, Account::getCurrency));
    }

    private long convertAmount(long amount, Currency sourceCurrency, Currency displayCurrency,
                               TreeMap<LocalDate, Map<String, Long>> historicalRates, LocalDate date) {
        if (sourceCurrency == null || sourceCurrency == displayCurrency) return amount;

        var entry = historicalRates.floorEntry(date);
        if (entry != null) {
            var dayRates = entry.getValue();
            Long sourceRate = dayRates.get(sourceCurrency.name());
            Long displayRate = dayRates.get(displayCurrency.name());
            if (sourceRate != null && sourceRate > 0 && displayRate != null && displayRate > 0) {
                return amount * sourceRate / displayRate;
            }
        }

        return amount;
    }

    private List<TransactionResponse> enrichWithNames(List<Transaction> transactions) {
        var accountIds = new HashSet<String>();
        var categoryIds = new HashSet<String>();
        var tagIds = new ArrayList<String>();

        for (var txn : transactions) {
            accountIds.add(txn.getAccountId());
            if (txn.getTargetAccountId() != null) accountIds.add(txn.getTargetAccountId());
            if (txn.getCategoryId() != null) categoryIds.add(txn.getCategoryId());
            if (txn.getTags() != null) tagIds.addAll(txn.getTags());
        }

        var accountNames = accountRepository.findAllById(accountIds).stream()
                .collect(Collectors.toMap(a -> a.getId(), a -> a.getName()));

        Map<String, String> categoryNames = categoryIds.isEmpty()
                ? Map.of()
                : categoryRepository.findAllById(categoryIds).stream()
                        .collect(Collectors.toMap(c -> c.getId(), c -> c.getName()));

        Map<String, String> tagNamesMap = tagIds.isEmpty()
                ? Map.of()
                : tagRepository.findAllById(tagIds).stream()
                        .collect(Collectors.toMap(Tag::getId, Tag::getName));

        return transactions.stream()
                .map(txn -> TransactionResponse.from(txn, accountNames, categoryNames, tagNamesMap))
                .toList();
    }
}
