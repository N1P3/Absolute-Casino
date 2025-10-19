package com.absoluteCasino.games.utilEntities;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NonNull;

import java.math.BigDecimal;

@Getter(value = AccessLevel.PACKAGE)
public final class ExchangeRate {

    private final Currency currencyNow;
    private final Currency currencyWanted;
    private final BigDecimal ExchangeRate;

    public ExchangeRate(@NonNull Currency currencyNow, @NonNull Currency currencyWanted, @NonNull BigDecimal ExchangeRate) {
        this.currencyNow = currencyNow;
        this.currencyWanted = currencyWanted;
        this.ExchangeRate = asExchangeRate(ExchangeRate);
    }

    public ExchangeRate reverse() {
        return new ExchangeRate(currencyWanted, currencyNow, reverse(ExchangeRate));
    }

    public static BigDecimal reverse(BigDecimal exchangeRate) {
        return BigDecimal.ONE.divide(asExchangeRate(exchangeRate), NumericStatics.EXCHANGE_RATE_SCALE, NumericStatics.ROUND_UP);
    }

    public static BigDecimal asExchangeRate(BigDecimal exchangeRate) {
        return exchangeRate.setScale(NumericStatics.EXCHANGE_RATE_SCALE, NumericStatics.ROUND_UP);
    }
}