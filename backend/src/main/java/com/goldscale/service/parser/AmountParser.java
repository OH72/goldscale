package com.goldscale.service.parser;

/**
 * Shared amount parsing utility. Converts formatted amount strings to subunits (long).
 * Avoids floating-point arithmetic by splitting on decimal separator.
 */
public final class AmountParser {

    private AmountParser() {}

    /**
     * Parse amount string with period as decimal separator.
     * Strips spaces, NBSP, and commas (thousands separator).
     * Examples: "-1 060.42" -> -106042, "5 000.00" -> 500000, "-175.91" -> -17591
     */
    public static long parseWithDotDecimal(String raw) {
        var cleaned = stripSpaces(raw).replace(",", "");
        return toSubunits(cleaned, '.');
    }

    /**
     * Parse amount string with comma as decimal separator (Polish/European format).
     * Strips spaces and NBSP. Periods are thousands separators.
     * Examples: "1.472,45" -> 147245, "9.729,58" -> 972958
     */
    public static long parseWithCommaDecimal(String raw) {
        var cleaned = stripSpaces(raw).replace(".", "");
        return toSubunits(cleaned, ',');
    }

    private static String stripSpaces(String raw) {
        return raw.replaceAll("[\\s\u00A0]", "").trim();
    }

    private static long toSubunits(String cleaned, char decimalSeparator) {
        boolean negative = cleaned.startsWith("-");
        if (negative) {
            cleaned = cleaned.substring(1);
        }

        int sepIndex = cleaned.indexOf(decimalSeparator);
        long intPart;
        long fracPart;

        if (sepIndex >= 0) {
            intPart = Long.parseLong(cleaned.substring(0, sepIndex));
            var fracStr = cleaned.substring(sepIndex + 1);
            if (fracStr.length() == 1) {
                fracPart = Long.parseLong(fracStr) * 10;
            } else if (fracStr.length() == 2) {
                fracPart = Long.parseLong(fracStr);
            } else {
                fracPart = Long.parseLong(fracStr.substring(0, 2));
            }
        } else {
            intPart = Long.parseLong(cleaned);
            fracPart = 0;
        }

        long subunits = intPart * 100 + fracPart;
        return negative ? -subunits : subunits;
    }
}
