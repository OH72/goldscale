package com.goldscale.service.parser;

import com.goldscale.dto.response.ImportRow;
import com.goldscale.model.BankType;
import com.goldscale.model.TransactionType;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Component
public class MillenniumParser implements StatementParser {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    // Matches data line: post date, value date, description, value, balance
    // PDFBox output: "2026-09-29 2026-09-29 PRZEKAZ SEPA 1.472,45  1.472,45 "
    // Polish format: period = thousands separator, comma = decimal separator
    private static final Pattern DATA_LINE = Pattern.compile(
            "^(\\d{4}-\\d{2}-\\d{2})\\s+\\d{4}-\\d{2}-\\d{2}\\s+(.+?)\\s+(-?[\\d.]+,\\d{2})\\s+(-?[\\d.]+,\\d{2})\\s*$"
    );

    @Override
    public BankType getBankType() {
        return BankType.MILLENNIUM;
    }

    @Override
    public List<ImportRow> parse(String pdfText) {
        var rows = new ArrayList<ImportRow>();
        var lines = pdfText.split("\n");
        int index = 0;

        for (int i = 0; i < lines.length; i++) {
            var line = lines[i];
            var matcher = DATA_LINE.matcher(line);
            if (!matcher.matches()) {
                continue;
            }

            var dateStr = matcher.group(1);
            var description = matcher.group(2).trim();
            var valueStr = matcher.group(3);

            // Collect continuation lines for full description
            while (i + 1 < lines.length) {
                var nextLine = lines[i + 1].trim();
                // Stop if next line starts with a date (new entry)
                if (nextLine.matches("^\\d{4}-\\d{2}-\\d{2}\\s+.*")) {
                    break;
                }
                // Stop if empty or footer
                if (nextLine.isEmpty() || nextLine.startsWith("www.") || nextLine.startsWith("TOTAL")
                        || nextLine.startsWith("CLOSING") || nextLine.startsWith("We wish")) {
                    break;
                }
                description = description + " " + nextLine;
                i++;
            }

            var date = LocalDate.parse(dateStr, DATE_FORMAT);
            long amount = AmountParser.parseWithCommaDecimal(valueStr);

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
        return "Millennium";
    }

    @Override
    public String getDetectedCurrency() {
        return "PLN";
    }
}
