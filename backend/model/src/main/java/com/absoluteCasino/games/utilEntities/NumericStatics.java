package com.absoluteCasino.games.utilEntities;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.math.RoundingMode;

@NoArgsConstructor(access = AccessLevel.PRIVATE) final class NumericStatics {

    static final int MONEY_SCALE = 2;
    static final int EXCHANGE_RATE_SCALE = 4;
    static final RoundingMode ROUND_UP = RoundingMode.HALF_UP;
    static final BigDecimal HUNDRED = new BigDecimal(100);
}
