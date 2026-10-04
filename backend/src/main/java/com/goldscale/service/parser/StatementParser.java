package com.goldscale.service.parser;

import com.goldscale.dto.response.ImportRow;
import com.goldscale.model.BankType;

import java.util.List;

public interface StatementParser {

    BankType getBankType();

    List<ImportRow> parse(String pdfText);

    String getBankName();

    String getDetectedCurrency();
}
