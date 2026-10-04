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
public class KredobankCardParser implements StatementParser {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    // Matches line starting with DD.MM.YYYY
    private static final Pattern DATE_START = Pattern.compile(
            "^(\\d{2}\\.\\d{2}\\.\\d{4})\\s+(.+)$"
    );

    // Amount at end of a line: "-351.15" or "13,500.00"
    private static final Pattern AMOUNT_END = Pattern.compile(
            "(-?[\\d,]+\\.\\d{2})\\s*$"
    );

    @Override
    public BankType getBankType() {
        return BankType.KREDOBANK_CARD;
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

            // Extract doc number and inline description
            String inlineDesc;
            var parts = beforeAmount.split("\\s+", 2);
            if (parts.length > 1) {
                inlineDesc = parts[1].trim();
            } else {
                inlineDesc = "";
            }

            // For card statements, the pre-description is always exactly one line starting with "Сума "
            // Only look at the immediately preceding line
            String preDesc = "";
            if (i > 0) {
                var prevLine = lines[i - 1].trim();
                if (prevLine.startsWith("Сума ")) {
                    preDesc = prevLine;
                }
            }

            // Collect continuation lines after
            var postDesc = new ArrayList<String>();
            while (i + 1 < lines.length) {
                var nextLine = lines[i + 1].trim();
                if (nextLine.isEmpty()) break;
                if (nextLine.matches("^\\d{2}\\.\\d{2}\\.\\d{4}\\s+.*")) break;
                if (nextLine.startsWith("Сума ") || isHeaderOrFooter(nextLine)) break;
                postDesc.add(nextLine);
                i++;
            }

            // Combine: pre-description + inline + post-description
            var fullDesc = new StringBuilder();
            if (!preDesc.isEmpty()) {
                fullDesc.append(preDesc);
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
                description = "Card transaction";
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
        return "Kredobank (Card)";
    }

    @Override
    public String getDetectedCurrency() {
        return "UAH";
    }
}
