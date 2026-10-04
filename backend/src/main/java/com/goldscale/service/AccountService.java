package com.goldscale.service;

import com.goldscale.dto.request.CreateAccountRequest;
import com.goldscale.dto.request.UpdateAccountRequest;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.Account;
import com.goldscale.model.Transaction;
import com.goldscale.model.TransactionType;
import com.goldscale.repository.AccountRepository;
import com.goldscale.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final MongoTemplate mongoTemplate;

    public List<Account> findAll() {
        return accountRepository.findAll();
    }

    public Account findById(String id) {
        return accountRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Account", id));
    }

    @Transactional
    public Account create(CreateAccountRequest request) {
        if (accountRepository.existsByName(request.name())) {
            throw new BusinessRuleException("Account with name '" + request.name() + "' already exists");
        }

        var account = new Account();
        account.setName(request.name());
        account.setCurrency(request.currency());
        account.setBalance(request.initialBalance());
        account = accountRepository.save(account);

        var txn = new Transaction();
        txn.setType(TransactionType.INITIAL_BALANCE);
        txn.setAccountId(account.getId());
        txn.setAmount(request.initialBalance());
        txn.setDate(LocalDate.now());
        txn.setDeleted(false);
        transactionRepository.save(txn);

        return account;
    }

    @Transactional
    public Account update(String id, UpdateAccountRequest request) {
        var account = findById(id);

        var existing = accountRepository.findByName(request.name());
        if (existing.isPresent() && !existing.get().getId().equals(id)) {
            throw new BusinessRuleException("Account with name '" + request.name() + "' already exists");
        }

        account.setName(request.name());
        account.setCurrency(request.currency());
        account.setActive(request.active());
        return accountRepository.save(account);
    }

    @Transactional
    public void delete(String id) {
        var account = findById(id);

        // Soft-delete all transactions where this account is source
        mongoTemplate.updateMulti(
                Query.query(Criteria.where("accountId").is(id).and("deleted").ne(true)),
                new Update().set("deleted", true).set("updatedAt", Instant.now()),
                Transaction.class
        );

        // Soft-delete all transactions where this account is transfer target
        mongoTemplate.updateMulti(
                Query.query(Criteria.where("targetAccountId").is(id).and("deleted").ne(true)),
                new Update().set("deleted", true).set("updatedAt", Instant.now()),
                Transaction.class
        );

        accountRepository.delete(account);
    }
}
