package com.absoluteCasino.games.utilEntities;

import jakarta.persistence.Embedded;
import lombok.*;

import java.math.BigDecimal;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@ToString
public final class FinancialValue implements Comparable<FinancialValue> {
    @Embedded
    private MonetaryValue value;
    private Currency currency;

    public static FinancialValue basedOnGrosze(Long grosze) {
        return new FinancialValue(MonetaryValue.basedOnGrosze(grosze));
    }

    public FinancialValue(@NonNull MonetaryValue value, @NonNull Currency currency) {
        this.value = value.roundUp();
        this.currency = currency;
    }

    public FinancialValue(MonetaryValue value) {
        this(value, Currency.PLN);
    }

    public FinancialValue(BigDecimal value, Currency currency) {
        this(new MonetaryValue(value), currency);
    }

    public FinancialValue(BigDecimal value) {
        this(value, Currency.PLN);
    }

    public FinancialValue(Number value, Currency currency) {
        this(new BigDecimal(value.toString()), currency);
    }

    public FinancialValue(Number value) {
        this(new BigDecimal(value.toString()), Currency.PLN);
    }

    boolean compareCurrencies(FinancialValue other) {
        return currency == other.currency;
    }

    public FinancialValue plus(FinancialValue other) {
        validateCurrency(other);
        return plus(other.value);
    }

    public FinancialValue minus(FinancialValue other) {
        validateCurrency(other);
        return minus(other.value);
    }

    public FinancialValue plus(MonetaryValue w) {
        return new FinancialValue(value.plus(w), currency);
    }

    public FinancialValue minus(MonetaryValue w) {
        return new FinancialValue(value.minus(w), currency);
    }

    public FinancialValue plus(BigDecimal w) {
        return new FinancialValue(value.plus(w), currency);
    }

    public FinancialValue minus(BigDecimal w) {
        return new FinancialValue(value.minus(w), currency);
    }

    public FinancialValue plus(Number w) {
        return plus(new BigDecimal(w.toString()));
    }

    public FinancialValue minus(Number w) {
        return minus(new BigDecimal(w.toString()));
    }

    public FinancialValue multiply(Number multiplier) {
        return new FinancialValue(value.multiply(multiplier), currency);
    }

    public FinancialValue divide(Number divider) {
        return new FinancialValue(value.divide(divider), currency);
    }

    public FinancialValue multiply(BigDecimal multiplier) {
        return new FinancialValue(value.multiply(multiplier), currency);
    }

    public FinancialValue divide(BigDecimal divider) {
        return new FinancialValue(value.divide(divider), currency);
    }

    public boolean equal(FinancialValue other) {
        validateCurrency(other);
        return compareTo(other) == 0;
    }

    public boolean greater(FinancialValue od) {
        validateCurrency(od);
        return compareTo(od) > 0;
    }

    public boolean greaterEqual(FinancialValue other) {
        return greater(other) || equal(other);
    }

    public boolean lesser(FinancialValue od) {
        validateCurrency(od);
        return compareTo(od) < 0;
    }

    public boolean lesserEqual(FinancialValue other) {
        return lesser(other) || equal(other);
    }

    public FinancialValue exchange(ExchangeRate exchangeRate) {
        validateExchangeRate(exchangeRate);
        return new FinancialValue(value.exchange(exchangeRate), exchangeRate.getCurrencyWanted());
    }

    @Override
    public int compareTo(FinancialValue other) {
        validateCurrency(other);
        return value.compareTo(other.value);
    }

    public String asText() {
        return value.asText() + " " + currency.getLabel();
    }

    private void validateExchangeRate(@NonNull ExchangeRate exchangeRate) {
        if (exchangeRate.getCurrencyNow() != currency) {
            String msg = "Proba wykonania przeliczenia z exchangeRateem o zrodlowej walucie roznej od waluty przeliczanej kwoty." + " Oczekuje waluty: " + currency + " dostalem walute: " + exchangeRate.getCurrencyNow();
            throw new IllegalArgumentException(msg);
        }
    }

    private void validateCurrency(@NonNull FinancialValue other) {
        if (!compareCurrencies(other)) {
            throw new IllegalArgumentException("Proba wykonania operacji na kwotach o roznych walutach. Oczekuje waluty: " + currency + " dostalem walute: " + other.currency);
        }
    }
}