package com.absoluteCasino.control.games.baccarat;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;


@Getter
@Setter
public class BaccaratGame {

    private List<String> playerHand = new ArrayList<>();
    private List<String> dealersHand = new ArrayList<>();
    private Long bet = 0L;
    private BaccaratPlayersChoice baccaratPlayersChoice;
    private boolean playerWon = false;
    private int playerScore = 0;
    private int dealerScore = 0;


    public int calculateHandValue(boolean isPlayerHand) {
        List<String> calculatedHand = new ArrayList<>();
        if (isPlayerHand) {
            calculatedHand.addAll(playerHand);
        } else {
            calculatedHand.addAll(dealersHand);
        }
        int value = 0;
        for (String card : calculatedHand) {
            if (card.charAt(0) == 'A') {
                value += 1;
            } else if (card.charAt(0) == 'K' || card.charAt(0) == 'Q' || card.charAt(0) == 'J' || card.charAt(0) == 'T') {
                value += 10;
            } else {
                value += Integer.parseInt(card.substring(0, 1));
            }
        }
        if (isPlayerHand) {
            playerScore = value % 10;
        } else {
            dealerScore = value % 10;
        }
        return value % 10;
    }

}
