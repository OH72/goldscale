package com.goldscale.service.parser;

import com.goldscale.exception.BusinessRuleException;
import com.goldscale.model.BankType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ParserDetector {

    private final Map<BankType, StatementParser> parsersByType;

    public ParserDetector(List<StatementParser> parsers) {
        this.parsersByType = parsers.stream()
                .collect(Collectors.toMap(StatementParser::getBankType, Function.identity()));
    }

    public StatementParser getParser(BankType bankType) {
        var parser = parsersByType.get(bankType);
        if (parser == null) {
            throw new BusinessRuleException("No parser available for bank type: " + bankType);
        }
        return parser;
    }
}
