package com.absoluteCasino.control.games.blackjack;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Setter
@Getter
public class BlackJackGame {

    private List<String> playerHand = new ArrayList<>();
    private List<String> splitHand = new ArrayList<>();
    private List<String> dealerHand = new ArrayList<>();
    private boolean isSplit = false;
    private boolean playerHandStand = false;
    private boolean splitHandStand = false;
    private Long bet = 0L;
    private Long betSplit = 0L;
    private Long moneyWon = 0L;
    private Long moneyWonSplit = 0L;
    private boolean splitable;


    public int calculateHandValue(boolean playersHand, boolean isSplitHand) {
        List<String> calculatedHand = new ArrayList<>();
        if (playersHand) {
            calculatedHand.addAll(playerHand);
        } else if (isSplitHand) {
            calculatedHand.addAll(splitHand);
        } else {
            calculatedHand.addAll(dealerHand);
        }
        int amountOfAces = 0;
        int value = 0;
        for (String card : calculatedHand) {
            if (card.charAt(0) == 'A') {
                value += 11;
                amountOfAces++;
            } else if (card.charAt(0) == 'K' || card.charAt(0) == 'Q' || card.charAt(0) == 'J' || card.charAt(0) == 'T') {
                value += 10;
            } else {
                value += Integer.parseInt(card.substring(0, 1));
            }
        }
        while (amountOfAces > 0 && value > 21) {
            value -= 10;
            amountOfAces--;
        }
        return value;
    }

    public boolean isSplitableOn10() {
        return (playerHand.getFirst().charAt(0) == 'K' || playerHand.getFirst().charAt(0) == 'Q' || playerHand.getFirst().charAt(0) == 'J' || playerHand.getFirst().charAt(0) == 'T') && calculateHandValue(true, false) == 20;
    }

}
