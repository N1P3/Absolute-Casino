package com.absoluteCasino.control.games.baccarat;

public enum BaccaratPlayersChoice {

    PUNTO("Players win"),
    BANCO("Dealers win"),
    TIE("Draw");

    String description;

    BaccaratPlayersChoice(String description) {
        this.description = description;
    }

}
