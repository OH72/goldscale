package com.goldscale.model;

public enum Currency {
    UAH(100),
    USD(100),
    EUR(100),
    PLN(100),
    GBP(100),
    USDT(100);

    private final int subunits;

    Currency(int subunits) {
        this.subunits = subunits;
    }

    public int getSubunits() {
        return subunits;
    }
}
