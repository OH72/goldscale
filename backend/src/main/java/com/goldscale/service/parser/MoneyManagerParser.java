package com.goldscale.service.parser;

import com.goldscale.dto.response.ImportRow;
import com.goldscale.model.BankType;
import com.goldscale.model.TransactionType;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

@Component
public class MoneyManagerParser implements StatementParser {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("M/d/yyyy");

    // Date line: M/D/YYYY (e.g., "6/21/2026", "10/4/2025")
    private static final Pattern DATE_LINE = Pattern.compile("^(\\d{1,2}/\\d{1,2}/\\d{4})$");

    // Transaction line: "From<Source> to<Target> <currency> <amount>"
    // PDFBox strips spaces inconsistently: "FromMonoBank to Продукти харчування UAH 85.11"
    // or "From Інше toMonoBank UAH 36.72"
    private static final Pattern TRANSACTION_LINE = Pattern.compile(
            "^From\\s*(.+?)\\s+to\\s*(.+?)\\s+(UAH|USD|EUR|PLN|GBP|USDT)\\s+([\\d,.]+)(?:\\s+\\(([A-Z]+)\\s+([\\d,.]+)\\))?$"
    );

    // Initial balance line: "AccountName UAH amount" (no "From...to...")
    private static final Pattern INITIAL_BALANCE_LINE = Pattern.compile(
            "^([\\w\\p{L} $€]+?)\\s+(UAH|USD|EUR|PLN|GBP|USDT)\\s+([\\d,.]+)$"
    );

    // Comment line
    private static final Pattern COMMENT_LINE = Pattern.compile("^Comment:\\s*(.+)$");

    // Tags line
    private static final Pattern TAGS_LINE = Pattern.compile("^Tags:\\s*(.+)$");

    // Section headers
    private static final Pattern EXPENSE_HEADER = Pattern.compile("Transaction list:\\s*Expenses");
    private static final Pattern INCOME_HEADER = Pattern.compile("Transaction list:\\s*Income");
    private static final Pattern TRANSFER_HEADER = Pattern.compile("Transfer list");

    private enum Section { EXPENSES, INCOME, TRANSFERS }

    @Override
    public BankType getBankType() {
        return BankType.MONEYMANAGER;
    }

    @Override
    public List<ImportRow> parse(String pdfText) {
        var rows = new ArrayList<ImportRow>();
        var lines = pdfText.split("\n");
        int index = 0;

        Section currentSection = null;
        LocalDate currentDate = null;

        for (int i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.isEmpty()) continue;

            // Detect section
            if (EXPENSE_HEADER.matcher(line).find()) {
                currentSection = Section.EXPENSES;
                continue;
            }
            if (INCOME_HEADER.matcher(line).find()) {
                currentSection = Section.INCOME;
                continue;
            }
            if (TRANSFER_HEADER.matcher(line).find()) {
                currentSection = Section.TRANSFERS;
                continue;
            }

            if (currentSection == null) continue;

            // Date line
            var dateMatcher = DATE_LINE.matcher(line);
            if (dateMatcher.matches()) {
                currentDate = LocalDate.parse(dateMatcher.group(1), DATE_FORMAT);
                continue;
            }

            // Check for initial balance (at the end, after all sections)
            // Format: "AccountName UAH amount" followed by "Initial balance" on next line
            if (i + 1 < lines.length && lines[i + 1].trim().equals("Initial balance")) {
                var ibMatcher = INITIAL_BALANCE_LINE.matcher(line);
                if (ibMatcher.matches()) {
                    var accountName = ibMatcher.group(1).trim();
                    var currency = ibMatcher.group(2);
                    long amount = parseAmount(ibMatcher.group(3));

                    rows.add(new ImportRow(
                            index++, TransactionType.INITIAL_BALANCE, amount,
                            currentDate != null ? currentDate : LocalDate.now(),
                            "Initial balance", null, null,
                            accountName, null, null, currency, null, null));
                    i++; // skip "Initial balance" line
                    continue;
                }
            }

            // Transaction line
            var txnMatcher = TRANSACTION_LINE.matcher(line);
            if (!txnMatcher.matches()) continue;

            var source = txnMatcher.group(1).trim();
            var target = txnMatcher.group(2).trim();
            var currency = txnMatcher.group(3);
            long amount = parseAmount(txnMatcher.group(4));
            String targetCurrency = txnMatcher.group(5);
            Long targetAmount = txnMatcher.group(6) != null ? parseAmount(txnMatcher.group(6)) : null;

            if (amount == 0) continue;

            // Look ahead for Comment and Tags lines
            String comment = null;
            List<String> tags = null;

            while (i + 1 < lines.length) {
                var nextLine = lines[i + 1].trim();
                var commentMatcher = COMMENT_LINE.matcher(nextLine);
                if (commentMatcher.matches()) {
                    comment = commentMatcher.group(1).trim();
                    i++;
                    continue;
                }
                var tagsMatcher = TAGS_LINE.matcher(nextLine);
                if (tagsMatcher.matches()) {
                    tags = Arrays.stream(tagsMatcher.group(1).split(","))
                            .map(String::trim)
                            .filter(t -> !t.isEmpty())
                            .toList();
                    i++;
                    continue;
                }
                break;
            }

            var sourceRef = SourceRefGenerator.generate(
                    currentDate, amount, source + " -> " + target);

            switch (currentSection) {
                case EXPENSES -> {
                    // Expense: From Account to Category
                    rows.add(new ImportRow(
                            index++, TransactionType.EXPENSE, amount, currentDate,
                            comment, target, sourceRef,
                            source, null, null, currency, null, tags));
                }
                case INCOME -> {
                    // Income: From Category to Account
                    rows.add(new ImportRow(
                            index++, TransactionType.INCOME, amount, currentDate,
                            comment, source, sourceRef,
                            target, null, null, currency, null, tags));
                }
                case TRANSFERS -> {
                    // Transfer: From Account to Account
                    // For cross-currency: amount is source amount in source currency,
                    // targetAmount is in target currency
                    if (targetCurrency != null && targetAmount != null) {
                        // Cross-currency: source sends 'amount' in 'currency',
                        // target receives 'targetAmount' in 'targetCurrency'
                        rows.add(new ImportRow(
                                index++, TransactionType.TRANSFER, amount, currentDate,
                                comment, null, sourceRef,
                                source, target, targetAmount, currency, targetCurrency, tags));
                    } else {
                        // Same-currency transfer
                        rows.add(new ImportRow(
                                index++, TransactionType.TRANSFER, amount, currentDate,
                                comment, null, sourceRef,
                                source, target, null, currency, null, tags));
                    }
                }
            }
        }

        return rows;
    }

    /**
     * Parse amount string like "85.11", "1,080.84", "50,000", "150".
     * MoneyManager uses dot as decimal separator and comma as thousands separator.
     * Returns amount in subunits (kopiyky/cents).
     */
    private static long parseAmount(String raw) {
        // Remove commas (thousands separator)
        var cleaned = raw.replace(",", "");
        return AmountParser.parseWithDotDecimal(cleaned);
    }

    @Override
    public String getBankName() {
        return "MoneyManager";
    }

    @Override
    public String getDetectedCurrency() {
        return "UAH";
    }
}
