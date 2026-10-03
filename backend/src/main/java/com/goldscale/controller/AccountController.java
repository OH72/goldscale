package com.goldscale.controller;

import com.goldscale.dto.request.CreateAccountRequest;
import com.goldscale.dto.request.UpdateAccountRequest;
import com.goldscale.dto.response.AccountResponse;
import com.goldscale.dto.response.AuditResponse;
import com.goldscale.service.AccountService;
import com.goldscale.service.BalanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;
    private final BalanceService balanceService;

    @GetMapping
    public ResponseEntity<List<AccountResponse>> findAll() {
        var accounts = accountService.findAll().stream()
                .map(AccountResponse::from)
                .toList();
        return ResponseEntity.ok(accounts);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AccountResponse> findById(@PathVariable String id) {
        var account = accountService.findById(id);
        return ResponseEntity.ok(AccountResponse.from(account));
    }

    @PostMapping
    public ResponseEntity<AccountResponse> create(@Valid @RequestBody CreateAccountRequest request) {
        var account = accountService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(AccountResponse.from(account));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AccountResponse> update(
            @PathVariable String id,
            @Valid @RequestBody UpdateAccountRequest request) {
        var account = accountService.update(id, request);
        return ResponseEntity.ok(AccountResponse.from(account));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        accountService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/audit")
    public ResponseEntity<AuditResponse> audit(@PathVariable String id) {
        return ResponseEntity.ok(balanceService.audit(id));
    }
}
