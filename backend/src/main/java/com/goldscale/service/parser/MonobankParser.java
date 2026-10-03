package com.goldscale.service.parser;

import com.goldscale.dto.response.ImportRow;
import com.goldscale.model.TransactionType;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Component
public class MonobankParser implements StatementParser {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    // Matches data line starting with a date (PDFBox strips leading spaces)
    private static final Pattern DATE_LINE = Pattern.compile(
            "^(\\d{2}\\.\\d{2}\\.\\d{4})\\s+(.+)$"
    );

    // Matches time continuation line
    private static final Pattern TIME_LINE = Pattern.compile(
            "^(\\d{2}:\\d{2}:\\d{2})\\s*(.*)$"
    );

    // Finds individual decimal amounts (may contain spaces as thousands separator)
    // Pattern: optional minus, digit, then digits/spaces, then .XX
    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
            "-?\\d[\\d ]*\\.\\d{2}"
    );

    // MCC code at end of text portion (4-digit number)
    private static final Pattern MCC_SUFFIX = Pattern.compile("^(.+?)\\s+(\\d{4})$");

    @Override
    public boolean canParse(String pdfText) {
        return pdfText.contains("UNIVERSAL BANK")
                || pdfText.contains("monobank")
                || pdfText.contains("Cash flow on the card");
    }

    @Override
    public List<ImportRow> parse(String pdfText) {
        var rows = new ArrayList<ImportRow>();
        var lines = pdfText.split("\n");
        int index = 0;

        for (int i = 0; i < lines.length; i++) {
            var line = lines[i];
            var dateMatcher = DATE_LINE.matcher(line);
            if (!dateMatcher.matches()) {
                continue;
            }

            var dateStr = dateMatcher.group(1);
            var restOfLine = dateMatcher.group(2).trim();

            // Find all decimal amounts in the line
            var amountMatcher = AMOUNT_PATTERN.matcher(restOfLine);
            var amounts = new ArrayList<String>();
            var firstAmountStart = -1;
            while (amountMatcher.find()) {
                if (firstAmountStart == -1) {
                    firstAmountStart = amountMatcher.start();
                }
                amounts.add(amountMatcher.group());
            }

            // Data lines must have at least 7 amounts (card, op, rate, commission, cashback, balance)
            // plus the line must contain a currency code or dash
            if (amounts.size() < 5 || firstAmountStart < 0) {
                continue;
            }

            // Card amount (UAH) is the first decimal amount after description + MCC
            var cardAmountStr = amounts.getFirst();

            // Text before the first amount is description + MCC
            var textPart = restOfLine.substring(0, firstAmountStart).trim();

            // Extract description: strip MCC code from end
            String description = textPart;
            var mccMatcher = MCC_SUFFIX.matcher(textPart);
            if (mccMatcher.matches()) {
                description = mccMatcher.group(1).trim();
            }

            // Check next line for time + description continuation
            if (i + 1 < lines.length) {
                var nextLine = lines[i + 1];
                var timeMatcher = TIME_LINE.matcher(nextLine);
                if (timeMatcher.matches()) {
                    var continuation = timeMatcher.group(2);
                    if (continuation != null && !continuation.isBlank()) {
                        description = description + " " + continuation.trim();
                    }
                    i++; // skip the time line
                }
            }

            var date = LocalDate.parse(dateStr, DATE_FORMAT);
            long amount = AmountParser.parseWithDotDecimal(cardAmountStr);

            if (amount == 0) {
                continue;
            }

            var type = amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
            long absAmount = Math.abs(amount);

            var sourceRef = SourceRefGenerator.generate(date, absAmount, description);

            rows.add(new ImportRow(index++, type, absAmount, date, description, description, sourceRef));
        }

        return rows;
    }

    @Override
    public String getBankName() {
        return "Monobank";
    }

    @Override
    public String getDetectedCurrency() {
        return "UAH";
    }
}
