package com.absoluteCasino.control.games.baccarat;

import com.absoluteCasino.control.games.GameSession;
import com.absoluteCasino.control.utils.CardsShoe;
import lombok.extern.java.Log;

@Log
public class BaccaratGameSession extends GameSession {

    CardsShoe cardsShoe;
    BaccaratGame baccaratGame;

    public BaccaratGameSession(String sessionId, Integer userId) {

        super(sessionId, userId);

        this.cardsShoe = new CardsShoe();
        this.baccaratGame = new BaccaratGame();

    }

    public String getCard() {
        return cardsShoe.getCard();
    }

    public BaccaratGameResponse dealCards(BaccaratPlayersChoice choice, long bet) {
        baccaratGame = new BaccaratGame();
        baccaratGame.setBet(bet);
        baccaratGame.setBaccaratPlayersChoice(choice);
        baccaratGame.getPlayerHand().add(getCard());
        baccaratGame.getDealersHand().add(getCard());
        baccaratGame.getPlayerHand().add(getCard());
        baccaratGame.getDealersHand().add(getCard());
        if (isGameOver()) {
            int playersScore = baccaratGame.getPlayerScore();
            int dealersScore = baccaratGame.getDealerScore();
            if (playersScore > dealersScore) {
                return new BaccaratGameResponse(true, baccaratGame.getPlayerHand(), baccaratGame.getDealersHand(), baccaratGame.getBet() * 2 * ((baccaratGame.getBaccaratPlayersChoice() == BaccaratPlayersChoice.PUNTO) ? 1 : 0), (baccaratGame.getBaccaratPlayersChoice() == BaccaratPlayersChoice.PUNTO) ? BaccaratGameResult.WIN : BaccaratGameResult.LOST);
            } else if (playersScore < dealersScore) {
                return new BaccaratGameResponse(true, baccaratGame.getPlayerHand(), baccaratGame.getDealersHand(), baccaratGame.getBet() * 2 * ((baccaratGame.getBaccaratPlayersChoice() == BaccaratPlayersChoice.BANCO) ? 1 : 0), (baccaratGame.getBaccaratPlayersChoice() == BaccaratPlayersChoice.BANCO) ? BaccaratGameResult.WIN : BaccaratGameResult.LOST);
            } else {
                return new BaccaratGameResponse(true, baccaratGame.getPlayerHand(), baccaratGame.getDealersHand(), baccaratGame.getBet() * 9 * ((baccaratGame.getBaccaratPlayersChoice() == BaccaratPlayersChoice.TIE) ? 1 : 0), (baccaratGame.getBaccaratPlayersChoice() == BaccaratPlayersChoice.TIE) ? BaccaratGameResult.WIN : BaccaratGameResult.LOST);
            }
        } else {
            return hit();
        }
    }

    public BaccaratGameResponse hit() {
        int playersScore = baccaratGame.getPlayerScore();
        int dealersScore = baccaratGame.getDealerScore();
        if (playersScore > 5) {
            if (dealersScore > 5) {
                return new BaccaratGameResponse(true, baccaratGame.getPlayerHand(), baccaratGame.getDealersHand(), howMuchDidPlayerWin(), baccaratGame.isPlayerWon() ? BaccaratGameResult.WIN : BaccaratGameResult.LOST);
            } else {
                baccaratGame.getDealersHand().add(getCard());
                baccaratGame.calculateHandValue(false);
                long moneyWon = howMuchDidPlayerWin();
                return new BaccaratGameResponse(true, baccaratGame.getPlayerHand(), baccaratGame.getDealersHand(), moneyWon, baccaratGame.isPlayerWon() ? BaccaratGameResult.WIN : BaccaratGameResult.LOST);
            }
        } else {
            String cardHitByPlayer = getCard();
            baccaratGame.getPlayerHand().add(cardHitByPlayer);
            int dealersValue = baccaratGame.getDealerScore();
            if (dealersValue <= 2) {
                baccaratGame.getDealersHand().add(getCard());
            } else if (dealersValue == 3 && cardHitByPlayer.charAt(0) == '8') {
                baccaratGame.getDealersHand().add(getCard());
            } else if (dealersValue == 4 && (cardHitByPlayer.charAt(0) == '2' || cardHitByPlayer.charAt(0) == '3' || cardHitByPlayer.charAt(0) == '4' || cardHitByPlayer.charAt(0) == '5' || cardHitByPlayer.charAt(0) == '6' || cardHitByPlayer.charAt(0) == '7')){
                baccaratGame.getDealersHand().add(getCard());
            } else if (dealersValue == 5 && (cardHitByPlayer.charAt(0) == '4' || cardHitByPlayer.charAt(0) == '5' || cardHitByPlayer.charAt(0) == '6' || cardHitByPlayer.charAt(0) == '7')){
                baccaratGame.getDealersHand().add(getCard());
            } else if (dealersValue == 6 && (cardHitByPlayer.charAt(0) == '6' || cardHitByPlayer.charAt(0) == '7')){
                baccaratGame.getDealersHand().add(getCard());
            }
        }
        baccaratGame.calculateHandValue(true);
        baccaratGame.calculateHandValue(false);
        Long moneyWon = howMuchDidPlayerWin();
        return new BaccaratGameResponse(true, baccaratGame.getPlayerHand(), baccaratGame.getDealersHand(), moneyWon, baccaratGame.isPlayerWon() ? BaccaratGameResult.WIN : BaccaratGameResult.LOST);
    }

    private boolean isGameOver() {
        int playerVal = baccaratGame.calculateHandValue(true);
        int bancoVal = baccaratGame.calculateHandValue(false);
        return playerVal >= 8 || bancoVal >= 8;
    }

    private Long howMuchDidPlayerWin() {
        int playersScore = baccaratGame.getPlayerScore();
        int dealersScore = baccaratGame.getDealerScore();
        long moneyWon;
        if (playersScore > dealersScore) {
            moneyWon = baccaratGame.getBet() * 2 * ((baccaratGame.getBaccaratPlayersChoice() == BaccaratPlayersChoice.PUNTO) ? 1 : 0);
        } else if (playersScore < dealersScore) {
            moneyWon = baccaratGame.getBet() * 2 * ((baccaratGame.getBaccaratPlayersChoice() == BaccaratPlayersChoice.BANCO) ? 1 : 0);
        } else {
            moneyWon = baccaratGame.getBet() * 9 * ((baccaratGame.getBaccaratPlayersChoice() == BaccaratPlayersChoice.TIE) ? 1 : 0);
        }
        if(moneyWon > 0L){
            baccaratGame.setPlayerWon(true);
        }
        return moneyWon;
    }
}
