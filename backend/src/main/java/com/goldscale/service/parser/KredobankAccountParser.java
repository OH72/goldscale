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
public class KredobankAccountParser implements StatementParser {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    // Matches line starting with DD.MM.YYYY (no leading spaces in PDFBox output)
    private static final Pattern DATE_START = Pattern.compile(
            "^(\\d{2}\\.\\d{2}\\.\\d{4})\\s+(.+)$"
    );

    // Amount at end of a line: "-5,000.00" or "94,268.86" (comma thousands, period decimal)
    private static final Pattern AMOUNT_END = Pattern.compile(
            "(-?[\\d,]+\\.\\d{2})\\s*$"
    );

    @Override
    public BankType getBankType() {
        return BankType.KREDOBANK_ACCOUNT;
    }

    @Override
    public List<ImportRow> parse(String pdfText) {
        var rows = new ArrayList<ImportRow>();
        var lines = pdfText.split("\n");
        int index = 0;

        for (int i = 0; i < lines.length; i++) {
            var line = lines[i];
            var dateMatcher = DATE_START.matcher(line);
            if (!dateMatcher.matches()) {
                continue;
            }

            var dateStr = dateMatcher.group(1);
            var rest = dateMatcher.group(2);

            // Check if this line ends with an amount
            var amountMatcher = AMOUNT_END.matcher(rest);
            if (!amountMatcher.find()) {
                continue;
            }

            var amountStr = amountMatcher.group(1);
            var beforeAmount = rest.substring(0, amountMatcher.start()).trim();

            // Extract doc number and inline description from beforeAmount
            // Format: "37729379 Transfer to the account" or "37968939" (no description)
            String inlineDesc;
            var parts = beforeAmount.split("\\s+", 2);
            if (parts.length > 1) {
                inlineDesc = parts[1].trim();
            } else {
                inlineDesc = "";
            }

            // Look backwards for pre-description lines (description often starts before the date line)
            var preDesc = new ArrayList<String>();
            for (int j = i - 1; j >= 0; j--) {
                var prevLine = lines[j].trim();
                if (prevLine.isEmpty()) break;
                if (prevLine.matches("^\\d{2}\\.\\d{2}\\.\\d{4}\\s+.*")) break;
                if (isHeaderOrFooter(prevLine)) break;
                // Stop at lines ending with period — they conclude a previous entry's description
                if (prevLine.endsWith(".") || prevLine.endsWith("ПДВ")) {
                    break;
                }
                preDesc.addFirst(prevLine);
            }

            // Collect continuation lines after the date line
            var postDesc = new ArrayList<String>();
            while (i + 1 < lines.length) {
                var nextLine = lines[i + 1].trim();
                if (nextLine.isEmpty()) break;
                if (nextLine.matches("^\\d{2}\\.\\d{2}\\.\\d{4}\\s+.*")) break;
                if (isHeaderOrFooter(nextLine)) break;
                // If inline desc exists and next line starts with uppercase — it's a new entry's pre-description
                if (!inlineDesc.isEmpty() && !nextLine.isEmpty()
                        && Character.isUpperCase(nextLine.codePointAt(0))) {
                    break;
                }
                postDesc.add(nextLine);
                i++;
            }

            // Combine: pre-description + inline + post-description
            var fullDesc = new StringBuilder();
            for (var part : preDesc) {
                if (!fullDesc.isEmpty()) fullDesc.append(" ");
                fullDesc.append(part);
            }
            if (!inlineDesc.isEmpty()) {
                if (!fullDesc.isEmpty()) fullDesc.append(" ");
                fullDesc.append(inlineDesc);
            }
            for (var part : postDesc) {
                if (!fullDesc.isEmpty()) fullDesc.append(" ");
                fullDesc.append(part);
            }

            var description = fullDesc.toString().trim();
            if (description.isEmpty()) {
                description = "Transaction";
            }

            var date = LocalDate.parse(dateStr, DATE_FORMAT);
            long amount = AmountParser.parseWithDotDecimal(amountStr);

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

    private static boolean isHeaderOrFooter(String line) {
        return line.startsWith("Дата") || line.startsWith("документа")
                || line.startsWith("рахунку") || line.startsWith("Вклади");
    }

    @Override
    public String getBankName() {
        return "Kredobank (Account)";
    }

    @Override
    public String getDetectedCurrency() {
        return "UAH";
    }
}
