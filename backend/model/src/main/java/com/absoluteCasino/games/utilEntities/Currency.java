package com.absoluteCasino.games.utilEntities;

import lombok.Getter;

@Getter
public enum Currency {
    PLN(0, "PLN", "złotówka", Double.valueOf(1)),
    EUR(1, "EUR", "euro", Double.valueOf(1)),
    USD(2, "USD", "dolar amerykański", Double.valueOf(1)),
    GBP(3, "GBP", "funt szterling", Double.valueOf(1)),
    JPY(4, "JPY", "jen", Double.valueOf(100)),
    CNY(5, "CNY", "yuan renminbi", Double.valueOf(1)),
    CHF(6, "CHF", "frank szwajcarski", Double.valueOf(1)),
    RUB(7, "RUB", "rubel rosyjski", Double.valueOf(1)),
    SEK(8, "SEK", "korona szwedzka", Double.valueOf(1)),
    AUD(9, "AUD", "dolar australijski", Double.valueOf(1)),
    HKD(10, "HKD", "dolar Hongkongu", Double.valueOf(1)),
    CAD(11, "CAD", "dolar kanadyjski", Double.valueOf(1)),
    NZD(12, "NZD", "dolar nowozelandzki", Double.valueOf(1)),
    SGD(13, "SGD", "dolar singapurski", Double.valueOf(1)),
    BRL(14, "BRL", "real brazylijski", Double.valueOf(1)),
    THB(15, "THB", "bat tajlandzki", Double.valueOf(1)),
    HUF(16, "HUF", "forint (Węgry)", Double.valueOf(100)),
    UAH(17, "UAH", "hrywna (Ukraina)", Double.valueOf(1)),
    CZK(18, "CZK", "korona czeska", Double.valueOf(1)),
    DKK(19, "DKK", "korona duńska", Double.valueOf(1)),
    ISK(20, "ISK", "korona islandzka", Double.valueOf(100)),
    NOK(21, "NOK", "korona norweska", Double.valueOf(1)),
    HRK(22, "HRK", "kuna chorwacka", Double.valueOf(1)),
    RON(23, "RON", "lej rumuński", Double.valueOf(1)),
    BGN(24, "BGN", "lew bułgarski", Double.valueOf(1)),
    TRY(25, "TRY", "lira turecka", Double.valueOf(1)),
    LTL(26, "LTL", "lit litewski", Double.valueOf(1)),
    LVT(27, "LVT", "łat łotewski", Double.valueOf(1)),
    ILS(28, "ILS", "szekel izraelski", Double.valueOf(1)),
    CLP(29, "CLP", "peso chilijskie", Double.valueOf(100)),
    PHP(30, "PHP", "peso filipińskie", Double.valueOf(1)),
    MXN(31, "MXN", "peso meksykańskie", Double.valueOf(1)),
    ZAR(32, "ZAR", "rand (RPA)", Double.valueOf(1)),
    MYR(33, "MYR", "ringgit malezyjski", Double.valueOf(1)),
    IDR(34, "IDR", "rupia (Indonezja)", Double.valueOf(10000)),
    INR(35, "INR", "rupia indyjska", Double.valueOf(100)),
    KRW(36, "KRW", "won (Korea Płd.)", Double.valueOf(100));

    private Integer id;

    private String label;

    private String description;

    private Double exchangeRateNBP;

    Currency(Integer id, String label, String description, Double exchangeRateNBP) {
        this.id = id;
        this.label = label;
        this.description = description;
        this.exchangeRateNBP = exchangeRateNBP;
    }

    @Override
    public String toString() {
        return getLabel();
    }

    public static Currency fromInt(int value) {
        for (Currency currency : Currency.values()) {
            if (currency.getId().intValue() == value) {
                return currency;
            }
        }
        return null;
    }

    public static Currency fromString(String value) {
        if (value == null) {
            return null;
        }

        for (Currency currency : Currency.values()) {
            if (currency.getLabel().matches(value.trim().toUpperCase())) {
                return currency;
            }
        }
        return null;
    }
}