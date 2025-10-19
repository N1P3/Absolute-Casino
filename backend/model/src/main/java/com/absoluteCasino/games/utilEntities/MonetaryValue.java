package com.absoluteCasino.games.utilEntities;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.math.BigDecimal;

@Getter
@ToString
@EqualsAndHashCode
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED) // For JPA
@Embeddable
public class MonetaryValue implements Comparable<MonetaryValue> {
    public static final MonetaryValue ZERO = new MonetaryValue(BigDecimal.ZERO);
    public static final MonetaryValue ONE = new MonetaryValue(BigDecimal.ONE);
    public static final MonetaryValue TEN = new MonetaryValue(BigDecimal.TEN);
    public static final MonetaryValue HUNDRED = new MonetaryValue(NumericStatics.HUNDRED);

    @NonNull
    @Column(name = "amount", precision = 18, scale = 2) // Change 'value' to 'amount'
    private BigDecimal amount;

    public static MonetaryValue basedOnGrosze(String grosze) {
        if (grosze == null || grosze.isEmpty()) {
            return MonetaryValue.ZERO;
        } else {
            return new MonetaryValue(grosze).divide(100).roundUp();
        }
    }

    public static MonetaryValue basedOnGrosze(Long grosze) {
        if (grosze == null) {
            return MonetaryValue.ZERO;
        }

        return new MonetaryValue(new BigDecimal(grosze).divide(NumericStatics.HUNDRED));
    }

    public MonetaryValue(String amount) {
        this(new BigDecimal(amount));
    }

    public MonetaryValue(Number amount) {
        this(new BigDecimal(amount.toString()));
    }

    public MonetaryValue roundUp() {
        return new MonetaryValue(amount.setScale(NumericStatics.MONEY_SCALE, NumericStatics.ROUND_UP));
    }

    public MonetaryValue roundUp(int spotsAfterComma) {
        if (amount.scale() == spotsAfterComma) {
            return this;
        }

        return new MonetaryValue(amount.setScale(spotsAfterComma, NumericStatics.ROUND_UP));
    }

    public FinancialValue asFinancialValue(Currency currency) {
        return new FinancialValue(this, currency);
    }

    public MonetaryValue plus(MonetaryValue multiplier) {
        return plus(multiplier.amount);
    }

    public MonetaryValue minus(MonetaryValue multiplier) {
        return minus(multiplier.amount);
    }

    public MonetaryValue plus(BigDecimal w) {
        return new MonetaryValue(amount.add(w));
    }

    public MonetaryValue minus(BigDecimal w) {
        return new MonetaryValue(amount.subtract(w));
    }

    public MonetaryValue plus(Number w) {
        return plus(new BigDecimal(w.toString()));
    }

    public MonetaryValue minus(Number w) {
        return minus(new BigDecimal(w.toString()));
    }

    public MonetaryValue multiply(BigDecimal multiplier) {
        return new MonetaryValue(amount.multiply(multiplier));
    }

    public MonetaryValue multiply(Number multiplier) {
        return multiply(new BigDecimal(multiplier.toString()));
    }

    public MonetaryValue divide(BigDecimal divider) {
        return divide(divider, NumericStatics.MONEY_SCALE);
    }

    public MonetaryValue divide(BigDecimal divider, int spotsAfterComma) {
        return new MonetaryValue(amount.divide(divider, spotsAfterComma, NumericStatics.ROUND_UP));
    }

    public MonetaryValue divide(Number divider, int spotsAfterComma) {
        return divide(new BigDecimal(divider.toString()), spotsAfterComma);
    }

    public MonetaryValue divide(Number divider) {
        return divide(divider, NumericStatics.MONEY_SCALE);
    }

    public boolean equal(MonetaryValue multiplier) {
        return compareTo(multiplier) == 0;
    }

    public boolean isDifferent(MonetaryValue multiplier) {
        return !equal(multiplier);
    }

    public boolean diffFromZero() {
        return isDifferent(MonetaryValue.ZERO);
    }

    public boolean isPositive() {
        return isgreater(ZERO);
    }

    public boolean isNegative() {
        return isSmaller(ZERO);
    }

    public boolean isgreater(MonetaryValue od) {
        return compareTo(od) > 0;
    }

    public boolean greaterEqual(MonetaryValue multiplier) {
        return isgreater(multiplier) || equal(multiplier);
    }

    public boolean isSmaller(MonetaryValue od) {
        return compareTo(od) < 0;
    }

    public boolean lesserEqual(MonetaryValue multiplier) {
        return isSmaller(multiplier) || equal(multiplier);
    }

    public MonetaryValue exchange(Number exchangeRate) {
        return exchange(new BigDecimal(exchangeRate.toString()));
    }

    public MonetaryValue exchange(BigDecimal exchangeRate) {
        return new MonetaryValue(amount.multiply(exchangeRate));
    }

    public MonetaryValue exchange(ExchangeRate exchangeRate) {
        return exchange(exchangeRate.getExchangeRate());
    }

    @Override
    public int compareTo(MonetaryValue multiplier) {
        return amount.compareTo(multiplier.amount);
    }

    public long asGrosze() {
        return this.multiply(NumericStatics.HUNDRED).roundUp(0).getAmount().longValue();
    }

    public BigDecimal asPLN() {
        return getAmount();
    }

    public String asText() {
        return amount.toString().replace('.', ',');
    }
}