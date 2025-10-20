package com.absoluteCasino.control.games;

import lombok.Getter;

@Getter
public abstract class GameSession {

    private String gameId;
    private Integer userId;

    public GameSession(String gameId, Integer userId) {
        this.gameId = gameId;
        this.userId = userId;
    }

}
