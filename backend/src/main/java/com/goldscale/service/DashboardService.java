package com.goldscale.service;

import com.goldscale.dto.response.AccountResponse;
import com.goldscale.dto.response.DashboardResponse;
import com.goldscale.dto.response.TransactionResponse;
import com.goldscale.model.Transaction;
import com.goldscale.model.TransactionType;
import com.goldscale.repository.AccountRepository;
import com.goldscale.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final AccountRepository accountRepository;
    private final CategoryRepository categoryRepository;
    private final MongoTemplate mongoTemplate;

    public DashboardResponse getDashboard() {
        var accounts = accountRepository.findAll().stream()
                .map(AccountResponse::from)
                .toList();

        var query = Query.query(Criteria.where("deleted").ne(true)
                        .and("type").ne(TransactionType.INITIAL_BALANCE))
                .with(Sort.by(Sort.Direction.DESC, "date", "createdAt"))
                .limit(10);

        var recentTxns = mongoTemplate.find(query, Transaction.class);
        var responses = enrichWithNames(recentTxns);

        return new DashboardResponse(accounts, responses);
    }

    private List<TransactionResponse> enrichWithNames(List<Transaction> transactions) {
        var accountIds = new HashSet<String>();
        var categoryIds = new HashSet<String>();

        for (var txn : transactions) {
            accountIds.add(txn.getAccountId());
            if (txn.getTargetAccountId() != null) accountIds.add(txn.getTargetAccountId());
            if (txn.getCategoryId() != null) categoryIds.add(txn.getCategoryId());
        }

        var accountNames = accountRepository.findAllById(accountIds).stream()
                .collect(Collectors.toMap(a -> a.getId(), a -> a.getName()));

        Map<String, String> categoryNames = categoryIds.isEmpty()
                ? Map.of()
                : categoryRepository.findAllById(categoryIds).stream()
                        .collect(Collectors.toMap(c -> c.getId(), c -> c.getName()));

        return transactions.stream()
                .map(txn -> TransactionResponse.from(txn, accountNames, categoryNames))
                .toList();
    }
}
