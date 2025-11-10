package com.absoluteCasino.control.games.makao;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Setter
@Getter
public class MakaoGame {
    private List<String> deck = new ArrayList<>();
    private String tableCard;
    private String currentSuit;
    private Character requiredNumber;
    private int pendingDrawCount;
    private String drawType;
    private int pendingSkipTurns;
    private int requirementTurnsLeft;
    private Integer playerToSkip;
    private Long bet = 0L;
    private Long moneyWon = 0L;

    public MakaoGame() {
        this.currentSuit = null;
        this.requiredNumber = null;
        this.pendingDrawCount = 0;
        this.drawType = null;
        this.pendingSkipTurns = 0;
        this.requirementTurnsLeft = 0;
        this.playerToSkip = null;
    }

    /**
     * Sprawdza czy karta może być zagrana na obecnej karcie stołu zgodnie z zasadami:
     *  - Jeśli aktywne jest dobieranie (pendingDrawCount>0) można zagrać tylko kolejną kartę serii (2,3,K(H/S))
     *  - Jeśli aktywne jest pomijanie tur (pendingSkipTurns>0) można zagrać tylko kolejną 4
     *  - Jeśli aktywny jest wymóg liczby (requiredNumber) można zagrać tylko kartę tej liczby
     *  - Jeśli aktywny jest wymóg koloru (currentSuit) można zagrać tylko kartę tego koloru lub Asa
     *  - W innym przypadku standardowo: karta o tej samej wartości lub kolorze jak karta na stole; As zawsze można
     */
    public boolean canPlayCard(String card, String tableCard, String activeSuit, Integer currentPlayerId) {
        if (card == null || card.length() < 2 || tableCard == null || tableCard.length() < 2) return false;
        char cardValue = card.charAt(0);
        char cardSuit = card.charAt(1);
        char tableValue = tableCard.charAt(0);
        char tableSuit = tableCard.charAt(1);

        if (playerToSkip != null && playerToSkip.equals(currentPlayerId)) {
            return cardValue == '4';
        }

        if (pendingDrawCount > 0) {
            return switch (drawType) {
                case "2" -> cardValue == '2';
                case "3" -> cardValue == '3';
                case "K" -> cardValue == 'K' && (cardSuit == 'H' || cardSuit == 'S');
                default -> false;
            };
        }

        if (requiredNumber != null) {
            return cardValue == requiredNumber;
        }

        if (activeSuit != null && !activeSuit.isEmpty()) {
            return cardSuit == activeSuit.charAt(0) || cardValue == 'A';
        }

        if (cardValue == 'A') return true;

        if (cardValue == 'J') return cardSuit == tableSuit || cardValue == tableValue;

        return cardValue == tableValue || cardSuit == tableSuit;
    }

    public void reset() {
        this.tableCard = null;
        this.currentSuit = null;
        this.requiredNumber = null;
        this.pendingDrawCount = 0;
        this.drawType = null;
        this.pendingSkipTurns = 0;
        this.requirementTurnsLeft = 0;
        this.playerToSkip = null;
        this.moneyWon = 0L;
    }
}
