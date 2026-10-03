package com.goldscale.controller;

import com.goldscale.dto.request.ImportConfirmRequest;
import com.goldscale.dto.response.ImportConfirmResponse;
import com.goldscale.dto.response.ImportPreviewResponse;
import com.goldscale.service.ImportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/import")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;

    @PostMapping("/preview")
    public ResponseEntity<ImportPreviewResponse> preview(
            @RequestParam("file") MultipartFile file,
            @RequestParam("accountId") String accountId) {
        return ResponseEntity.ok(importService.preview(file, accountId));
    }

    @PostMapping("/confirm")
    public ResponseEntity<ImportConfirmResponse> confirm(
            @RequestBody @Valid ImportConfirmRequest request) {
        return ResponseEntity.ok(importService.confirmImport(request));
    }
}
