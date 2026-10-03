package com.goldscale.service;

import com.goldscale.dto.request.ConfirmRow;
import com.goldscale.dto.request.ImportConfirmRequest;
import com.goldscale.dto.response.ImportConfirmResponse;
import com.goldscale.dto.response.ImportPreviewResponse;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.model.Transaction;
import com.goldscale.model.TransactionType;
import com.goldscale.service.parser.ParserDetector;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Service
@RequiredArgsConstructor
public class ImportService {

    private final ParserDetector parserDetector;
    private final TransactionService transactionService;
    private final MongoTemplate mongoTemplate;

    public ImportPreviewResponse preview(MultipartFile file, String accountId) {
        validateFile(file);

        var pdfText = extractText(file);
        var parser = parserDetector.detect(pdfText);
        var rows = parser.parse(pdfText);

        return new ImportPreviewResponse(rows, parser.getBankName(), parser.getDetectedCurrency());
    }

    @Transactional
    public ImportConfirmResponse confirmImport(ImportConfirmRequest request) {
        int imported = 0;
        int skipped = 0;

        for (var row : request.rows()) {
            validateRowType(row);

            if (isDuplicate(request.accountId(), row)) {
                skipped++;
                continue;
            }

            transactionService.createIncomeOrExpense(
                    request.accountId(), row.amount(), row.categoryId(),
                    row.date(), row.description(), row.type());
            imported++;
        }

        return new ImportConfirmResponse(imported, skipped);
    }

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new BusinessRuleException("File is empty");
        }

        var contentType = file.getContentType();
        if (contentType == null || !contentType.equals("application/pdf")) {
            throw new BusinessRuleException("File must be a PDF document");
        }
    }

    private String extractText(MultipartFile file) {
        try (var document = Loader.loadPDF(file.getInputStream().readAllBytes())) {
            var stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            return stripper.getText(document).replace('\u00A0', ' ');
        } catch (IOException e) {
            throw new BusinessRuleException("Failed to read PDF file: " + e.getMessage());
        }
    }

    private void validateRowType(ConfirmRow row) {
        if (row.type() != TransactionType.INCOME && row.type() != TransactionType.EXPENSE) {
            throw new BusinessRuleException("Import only supports INCOME and EXPENSE transactions");
        }
    }

    private boolean isDuplicate(String accountId, ConfirmRow row) {
        var query = Query.query(
                Criteria.where("accountId").is(accountId)
                        .and("date").is(row.date())
                        .and("amount").is(row.amount())
                        .and("description").is(row.description())
                        .and("deleted").ne(true)
        );
        return mongoTemplate.exists(query, Transaction.class);
    }
}
