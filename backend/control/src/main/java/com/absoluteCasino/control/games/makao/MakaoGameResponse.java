package com.absoluteCasino.control.games.makao;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Setter
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class MakaoGameResponse {
    private String type;
    private List<String> playerHand;
    private int opponentHandCount;
    private String tableCard;
    private String currentSuit;
    private Character requiredNumber;
    private int pendingDrawCount;
    private String drawType;
    private int pendingSkipTurns;
    private Integer playerToSkip;
    private Integer currentPlayerId;
    private String currentPlayerName;
    private boolean gameOver;
    private String result;
    private Long moneyWon;
    private String message;
    private List<MakaoPlayerInfo> players;

    @Setter
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MakaoPlayerInfo {
        private Integer userId;
        private String userName;
        private int handCount;
        private boolean isCurrent;
    }
}
