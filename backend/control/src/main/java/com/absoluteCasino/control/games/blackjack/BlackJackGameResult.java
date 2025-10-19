package com.absoluteCasino.control.games.blackjack;

public enum BlackJackGameResult {

    WIN("Player wins"),
    DRAW("Player draws"),
    LOST("Player lost"),
    UNRESOLVED("game unresolved"),
    BLACKJACK("blackjack");

    final String gameResult;

    BlackJackGameResult(String gameResult){
        this.gameResult = gameResult;
    }

    @Override
    public String toString() {
        return gameResult;
    }
}
