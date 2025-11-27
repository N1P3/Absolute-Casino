package com.absoluteCasino.control.games.makao;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.Collections;
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
     * Główna metoda wykonująca ruch - zagranie kart
     * @param cardsToPlay Lista kart do zagrania (te same wartości)
     * @param chosenSuit Wybrany kolor po Asie
     * @param chosenNumber Wybrana liczba po Walecie
     * @param nextPlayerId ID następnego gracza (do ustawienia playerToSkip dla 4)
     * @return true jeśli ruch wykonano pomyślnie
     */
    public PlayResult playCards(List<String> cardsToPlay, String chosenSuit, String chosenNumber, Integer currentPlayerId, Integer nextPlayerId) {
        if (cardsToPlay == null || cardsToPlay.isEmpty()) {
            return PlayResult.error("Nie wybrano kart");
        }

        // Validate same rank if multiple
        if (cardsToPlay.size() > 1) {
            char firstRank = cardsToPlay.get(0).charAt(0);
            for (String c : cardsToPlay) {
                if (c.charAt(0) != firstRank) {
                    return PlayResult.error("Karty muszą być tej samej wartości");
                }
            }
        }

        // Check if at least one card can be played on table
        boolean canPlay = false;
        for (String card : cardsToPlay) {
            if (canPlayCard(card, tableCard, currentSuit, currentPlayerId)) {
                canPlay = true;
                break;
            }
        }

        if (!canPlay) {
            return PlayResult.error("Nie możesz zagrać tych kart");
        }

        // Process each card
        for (String card : cardsToPlay) {
            tableCard = card;
            char value = card.charAt(0);
            char suit = card.charAt(1);

            // Handle card effects
            if (value == 'A') {
                if (chosenSuit == null || chosenSuit.isEmpty()) {
                    return PlayResult.error("Musisz wybrać kolor po Asie");
                }
                currentSuit = chosenSuit;
                requiredNumber = null;
                requirementTurnsLeft = 2;
            } else if (value == 'J') {
                if (chosenNumber == null || chosenNumber.isEmpty()) {
                    return PlayResult.error("Musisz wybrać liczbę po Walecie");
                }
                char num = chosenNumber.charAt(0);
                if (!(num >= '5' && num <= '9' || num == 'T')) {
                    return PlayResult.error("Nieprawidłowa liczba (5-10)");
                }
                requiredNumber = num;
                currentSuit = null;
                requirementTurnsLeft = 2;
            } else {
                // Decrement requirements
                if (requirementTurnsLeft > 0) {
                    requirementTurnsLeft--;
                    if (requirementTurnsLeft == 0) {
                        currentSuit = null;
                        requiredNumber = null;
                    }
                }
            }

            // Apply stacking logic
            if (value == '2') {
                if (pendingDrawCount == 0) drawType = "2";
                pendingDrawCount += 2;
            } else if (value == '3') {
                if (pendingDrawCount == 0) drawType = "3";
                pendingDrawCount += 3;
            } else if (value == '4') {
                if (playerToSkip != null && playerToSkip.equals(currentPlayerId) && pendingSkipTurns > 0) {
                    // Counter - pass back to opponent
                    playerToSkip = nextPlayerId;
                    pendingSkipTurns++;
                } else {
                    // New skip penalty
                    playerToSkip = nextPlayerId;
                    pendingSkipTurns++;
                }
            } else if (value == 'K' && (suit == 'H' || suit == 'S')) {
                if (pendingDrawCount == 0) drawType = "K";
                pendingDrawCount += 5;
            } else {
                // Non-special card clears draw stack
                if (pendingDrawCount > 0) {
                    pendingDrawCount = 0;
                    drawType = null;
                }
            }
        }

        return PlayResult.success();
    }

    /**
     * Wykonuje dobieranie kart
     * @return liczba kart do dobrania
     */
    public int drawCards() {
        // Decrement requirements
        if (requirementTurnsLeft > 0) {
            requirementTurnsLeft--;
            if (requirementTurnsLeft == 0) {
                currentSuit = null;
                requiredNumber = null;
            }
        }

        int toDraw = pendingDrawCount > 0 ? pendingDrawCount : 1;
        
        if (pendingDrawCount > 0) {
            pendingDrawCount = 0;
            drawType = null;
        }

        return toDraw;
    }

    /**
     * Wykonuje pomijanie tury
     */
    public PlayResult skipTurn(Integer playerId) {
        if (playerToSkip == null || !playerToSkip.equals(playerId) || pendingSkipTurns <= 0) {
            return PlayResult.error("Nie musisz pomijać tury");
        }

        // Decrement requirements
        if (requirementTurnsLeft > 0) {
            requirementTurnsLeft--;
            if (requirementTurnsLeft == 0) {
                currentSuit = null;
                requiredNumber = null;
            }
        }

        pendingSkipTurns--;
        if (pendingSkipTurns <= 0) {
            playerToSkip = null;
            pendingSkipTurns = 0;
        }

        return PlayResult.success();
    }

    /**
     * Sprawdza czy karta może być zagrana na obecnej karcie stołu zgodnie z zasadami:
     *  - Jeśli gracz ma playerToSkip i pendingSkipTurns>0 -> można zagrać tylko 4
     *  - Jeśli aktywne jest dobieranie (pendingDrawCount>0) -> można zagrać tylko kolejną kartę serii (2,3,K(H/S))
     *  - Jeśli aktywny jest wymóg liczby (requiredNumber) -> można zagrać tylko kartę tej liczby
     *  - Jeśli aktywny jest wymóg koloru (currentSuit) -> można zagrać tylko kartę tego koloru lub Asa
     *  - W innym przypadku standardowo: karta o tej samej wartości lub kolorze jak karta na stole; As zawsze można
     */
    public boolean canPlayCard(String card, String tableCard, String activeSuit, Integer currentPlayerId) {
        if (card == null || card.length() < 2 || tableCard == null || tableCard.length() < 2) return false;
        char cardValue = card.charAt(0);
        char cardSuit = card.charAt(1);
        char tableValue = tableCard.charAt(0);
        char tableSuit = tableCard.charAt(1);

        // Skip Turn Logic - must have pending skips active
        if (pendingSkipTurns > 0 && playerToSkip != null && playerToSkip.equals(currentPlayerId)) {
            return cardValue == '4';
        }

        // Draw Stack Logic
        if (pendingDrawCount > 0) {
            return switch (drawType) {
                case "2" -> cardValue == '2';
                case "3" -> cardValue == '3';
                case "K" -> cardValue == 'K' && (cardSuit == 'H' || cardSuit == 'S');
                default -> false;
            };
        }

        // Required Number (Jack effect)
        if (requiredNumber != null) {
            return cardValue == requiredNumber;
        }

        // Required Suit (Ace effect)
        if (activeSuit != null && !activeSuit.isEmpty()) {
            return cardSuit == activeSuit.charAt(0) || cardValue == 'A';
        }

        // Ace can always be played
        if (cardValue == 'A') return true;

        // Jack can be played on same suit or on another Jack
        if (cardValue == 'J') return cardSuit == tableSuit || cardValue == tableValue;

        // Standard: same value or same suit
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

    /**
     * Klasa pomocnicza do zwracania wyników operacji
     */
    public static class PlayResult {
        public final boolean success;
        public final String errorMessage;

        private PlayResult(boolean success, String errorMessage) {
            this.success = success;
            this.errorMessage = errorMessage;
        }

        public static PlayResult success() {
            return new PlayResult(true, null);
        }

        public static PlayResult error(String message) {
            return new PlayResult(false, message);
        }
    }
}
