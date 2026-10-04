package com.goldscale.controller;

import com.goldscale.service.BackupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/backup")
@RequiredArgsConstructor
public class BackupController {

    private final BackupService backupService;

    @GetMapping
    public ResponseEntity<StreamingResponseBody> export() {
        var filename = "goldscale-backup-" + LocalDate.now() + ".zip";

        StreamingResponseBody body = outputStream -> backupService.export(outputStream);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/zip"))
                .body(body);
    }

    @PostMapping("/restore")
    public ResponseEntity<Map<String, Object>> restore(@RequestParam("file") MultipartFile file) throws Exception {
        var counts = backupService.restore(file.getInputStream());
        return ResponseEntity.ok(Map.of(
                "message", "Database restored successfully",
                "collections", counts
        ));
    }
}
