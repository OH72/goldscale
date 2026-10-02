package com.goldscale.service;

import com.goldscale.model.TransactionType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
class BalanceServiceTest {

    @Mock
    private MongoTemplate mongoTemplate;

    private BalanceService balanceService;

    @BeforeEach
    void setUp() {
        balanceService = new BalanceService(mongoTemplate);
    }

    @Test
    void should_returnPositiveDelta_when_incomeType() {
        assertThat(balanceService.calculateDelta(TransactionType.INCOME, 5000)).isEqualTo(5000);
    }

    @Test
    void should_returnNegativeDelta_when_expenseType() {
        assertThat(balanceService.calculateDelta(TransactionType.EXPENSE, 3000)).isEqualTo(-3000);
    }

    @Test
    void should_returnPositiveDelta_when_initialBalanceType() {
        assertThat(balanceService.calculateDelta(TransactionType.INITIAL_BALANCE, 10000)).isEqualTo(10000);
    }

    @Test
    void should_throwException_when_transferType() {
        assertThatThrownBy(() -> balanceService.calculateDelta(TransactionType.TRANSFER, 1000))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
