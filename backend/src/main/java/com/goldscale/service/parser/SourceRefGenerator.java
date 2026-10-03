package com.goldscale.service.parser;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.HexFormat;

/**
 * Generates a deterministic sourceRef hash from date + amount + description.
 * Used for duplicate detection during import confirmation.
 */
public final class SourceRefGenerator {

    private SourceRefGenerator() {}

    public static String generate(LocalDate date, long amount, String description) {
        var input = date.toString() + "|" + amount + "|" + description;
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            var hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
