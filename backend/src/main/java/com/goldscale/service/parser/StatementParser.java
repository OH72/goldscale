package com.goldscale.service.parser;

import com.goldscale.dto.response.ImportRow;

import java.util.List;

public interface StatementParser {

    boolean canParse(String pdfText);

    List<ImportRow> parse(String pdfText);

    String getBankName();

    String getDetectedCurrency();
}
