package com.goldscale.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DebtLink {
    private String debtRecordId;
    private String paymentId;
    private long amount;
}
