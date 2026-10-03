package com.goldscale.service.parser;

import com.goldscale.exception.BusinessRuleException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class ParserDetector {

    private final List<StatementParser> parsers;

    public StatementParser detect(String pdfText) {
        return parsers.stream()
                .filter(parser -> parser.canParse(pdfText))
                .findFirst()
                .orElseThrow(() -> new BusinessRuleException(
                        "Unsupported bank statement format"));
    }
}
