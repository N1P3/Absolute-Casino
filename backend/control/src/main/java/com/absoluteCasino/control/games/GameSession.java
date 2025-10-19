package com.absoluteCasino.control.games;

import lombok.Getter;

@Getter
public abstract class GameSession {

    public static String BLACKJACK = "blackjack";
    public static String MUMMY = "mummy";
    public static String FRUITOGEDON = "fruitogedon";
    public static String BACCARAT = "baccarat";

    private String gameType;
    private Integer userId;

    public GameSession(String gameType, Integer userId) {
        this.gameType = gameType;
        this.userId = userId;
    }

}
