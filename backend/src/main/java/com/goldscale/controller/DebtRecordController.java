package com.goldscale.controller;

import com.goldscale.dto.request.AddPaymentRequest;
import com.goldscale.dto.request.CreateDebtRecordRequest;
import com.goldscale.dto.request.UpdateDebtRecordRequest;
import com.goldscale.dto.response.DebtRecordResponse;
import com.goldscale.dto.response.DebtSummaryResponse;
import com.goldscale.model.DebtStatus;
import com.goldscale.model.DebtType;
import com.goldscale.service.DebtRecordService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/debt-records")
@RequiredArgsConstructor
public class DebtRecordController {

    private final DebtRecordService debtRecordService;

    @GetMapping
    public ResponseEntity<List<DebtRecordResponse>> findAll(
            @RequestParam(required = false) String personId,
            @RequestParam(required = false) DebtType type,
            @RequestParam(required = false) DebtStatus status) {
        var records = debtRecordService.findAll(personId, type, status);
        return ResponseEntity.ok(records);
    }

    @GetMapping("/{id}")
    public ResponseEntity<DebtRecordResponse> findById(@PathVariable String id) {
        return ResponseEntity.ok(debtRecordService.findById(id));
    }

    @PostMapping
    public ResponseEntity<DebtRecordResponse> create(@Valid @RequestBody CreateDebtRecordRequest request) {
        var record = debtRecordService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(record);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DebtRecordResponse> update(
            @PathVariable String id,
            @Valid @RequestBody UpdateDebtRecordRequest request) {
        return ResponseEntity.ok(debtRecordService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        debtRecordService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/payments")
    public ResponseEntity<DebtRecordResponse> addPayment(
            @PathVariable String id,
            @Valid @RequestBody AddPaymentRequest request) {
        return ResponseEntity.ok(debtRecordService.addPayment(id, request));
    }

    @DeleteMapping("/{id}/payments/{paymentId}")
    public ResponseEntity<DebtRecordResponse> removePayment(
            @PathVariable String id,
            @PathVariable String paymentId) {
        return ResponseEntity.ok(debtRecordService.removePayment(id, paymentId));
    }

    @PutMapping("/{id}/toggle-status")
    public ResponseEntity<DebtRecordResponse> toggleStatus(@PathVariable String id) {
        return ResponseEntity.ok(debtRecordService.toggleStatus(id));
    }

    @GetMapping("/summary")
    public ResponseEntity<DebtSummaryResponse> getSummary() {
        return ResponseEntity.ok(debtRecordService.getSummary());
    }
}
