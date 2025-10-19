package com.absoluteCasino.control.games.blackjack;

import com.absoluteCasino.control.games.GameSession;
import com.absoluteCasino.control.utils.CardsShoe;
import lombok.extern.java.Log;

import java.util.Objects;

@Log
public class BlackJackGameSession extends GameSession {

    CardsShoe cardsShoe;
    BlackJackGame blackJackGame;

    public BlackJackGameSession(Integer userId) {

        super(GameSession.BLACKJACK, userId);

        this.cardsShoe = new CardsShoe();
        this.blackJackGame = new BlackJackGame();

    }

    public String getCard() {
        return cardsShoe.getCard();
    }

    public BlackJackGameResponse dealCards(Long bet, boolean suffDoubleBetFunds) {
        blackJackGame = new BlackJackGame();
        blackJackGame.setBet(bet);
        blackJackGame.setBetSplit(bet);
        if (cardsShoe.getCardsLeft() < 130) {
            cardsShoe = new CardsShoe();
        }
        blackJackGame.getPlayerHand().add(getCard());
        blackJackGame.getPlayerHand().add(getCard());
        blackJackGame.getDealerHand().add(getCard());
        blackJackGame.getDealerHand().add(getCard());
        BlackJackGameResult blackJackGameResult = BlackJackGameResult.UNRESOLVED;
        if (blackJackGame.calculateHandValue(true, false) == 21) {
            if (blackJackGame.calculateHandValue(false, false) == 21) {
                blackJackGameResult = BlackJackGameResult.DRAW;
                blackJackGame.setMoneyWon(blackJackGame.getBet());
            } else {
                blackJackGameResult = BlackJackGameResult.BLACKJACK;
                while (blackJackGame.calculateHandValue(false, false) < 17) {
                    blackJackGame.getDealerHand().add(getCard());
                }
                blackJackGame.setMoneyWon((long) (blackJackGame.getBet() * 2.5));
            }
        } else if (blackJackGame.calculateHandValue(false, false) == 21 && blackJackGame.getDealerHand().getFirst().startsWith("A")) {
            blackJackGameResult = BlackJackGameResult.LOST;
        }
        boolean doubleable = blackJackGameResult == BlackJackGameResult.UNRESOLVED && suffDoubleBetFunds;
        boolean splitable = (blackJackGame.getPlayerHand().getFirst().substring(0, 1).equals(blackJackGame.getPlayerHand().get(1).substring(0, 1)) || blackJackGame.isSplitableOn10()) && suffDoubleBetFunds;
        blackJackGame.setSplitable(splitable);
        return new BlackJackGameResponse(
                blackJackGame.getPlayerHand(),
                blackJackGame.getDealerHand(),
                blackJackGameResult,
                blackJackGame.getMoneyWon(),
                doubleable,
                splitable
        );

    }

    public BlackJackGameResponse hit(boolean withDouble) {
        String cardDrawn = getCard();
        log.info(cardDrawn);
        if (!blackJackGame.isSplit()) {
            blackJackGame.getPlayerHand().add(cardDrawn);
            BlackJackGameResult blackJackGameResult = BlackJackGameResult.UNRESOLVED;
            if (blackJackGame.calculateHandValue(true, false) > 21) {
                blackJackGameResult = BlackJackGameResult.LOST;
                while (blackJackGame.calculateHandValue(false, false) < 17) {
                    blackJackGame.getDealerHand().add(getCard());
                }
            } else if (blackJackGame.calculateHandValue(true, false) == 21 || withDouble) {
                if (withDouble) {
                    blackJackGame.setBet(blackJackGame.getBet() * 2);
                }
                return stand(true, cardDrawn);
            }
            return new BlackJackGameResponse(
                    blackJackGame.getPlayerHand(),
                    blackJackGame.getDealerHand(),
                    cardDrawn,
                    blackJackGameResult,
                    blackJackGame.getMoneyWon()
            );
        } else {
            if (withDouble) {
                if (blackJackGame.isPlayerHandStand()) {
                    if (Objects.equals(blackJackGame.getBet(), blackJackGame.getBetSplit())) {
                        blackJackGame.setBetSplit(blackJackGame.getBet() * 2);
                    } else {
                        blackJackGame.setBetSplit(blackJackGame.getBet());
                    }
                } else {
                    blackJackGame.setBet(blackJackGame.getBet() * 2);
                }
            }
            if (!blackJackGame.isPlayerHandStand()) {
                blackJackGame.getPlayerHand().add(cardDrawn);
                if (blackJackGame.calculateHandValue(true, false) >= 21 || withDouble) {
                    blackJackGame.setPlayerHandStand(true);
                }
            } else {
                blackJackGame.getSplitHand().add(cardDrawn);
                if (blackJackGame.calculateHandValue(false, true) >= 21 || withDouble) {
                    blackJackGame.setSplitHandStand(true);
                }
            }
            return splitResponse(cardDrawn);
        }
    }

    public BlackJackGameResponse stand(boolean isDoubleOr21AfterHit, String cardDrawn) {
        if (!blackJackGame.isSplit()) {
            while (blackJackGame.calculateHandValue(false, false) < 17) {
                blackJackGame.getDealerHand().add(getCard());
            }
        } else if (!blackJackGame.isPlayerHandStand()) {
            blackJackGame.setPlayerHandStand(true);
            return splitResponse(cardDrawn);
        } else {
            blackJackGame.setSplitHandStand(true);
            return splitResponse(cardDrawn);
        }
        return determineWinner(isDoubleOr21AfterHit, cardDrawn);
    }

    public BlackJackGameResponse split() {
        blackJackGame.setSplit(true);
        blackJackGame.getSplitHand().add(blackJackGame.getPlayerHand().get(1));
        blackJackGame.getPlayerHand().remove(1);
        blackJackGame.getPlayerHand().add(getCard());
        blackJackGame.getSplitHand().add(getCard());
        BlackJackGameResult blackJackGameResult = BlackJackGameResult.UNRESOLVED;
        if (blackJackGame.calculateHandValue(true, false) == 21 && blackJackGame.calculateHandValue(false, true) == 21) {
            while (blackJackGame.calculateHandValue(false, false) < 17) {
                blackJackGame.getDealerHand().add(getCard());
            }
            blackJackGameResult = getBlackJackGameResult(21, blackJackGame.calculateHandValue(false, false));
        }

        if (blackJackGame.calculateHandValue(true, false) == 21) {
            blackJackGame.setPlayerHandStand(true);
        }

        return new BlackJackGameResponse(
                blackJackGame.getPlayerHand(),
                blackJackGame.getDealerHand(),
                blackJackGameResult,
                blackJackGame.getMoneyWon(),
                blackJackGame.calculateHandValue(true, false) == 21,
                blackJackGame.getSplitHand()
        );
    }

    private BlackJackGameResponse determineWinner(boolean standAfterDoubleOr21, String cardDrawn) {
        int playerScore = blackJackGame.calculateHandValue(true, false);
        int dealerScore = blackJackGame.calculateHandValue(false, false);
        BlackJackGameResult blackJackGameResult = getBlackJackGameResult(playerScore, dealerScore);

        if (blackJackGameResult.equals(BlackJackGameResult.WIN)) {
            blackJackGame.setMoneyWon(blackJackGame.getBet() * 2);
        } else if (blackJackGameResult.equals(BlackJackGameResult.DRAW)) {
            blackJackGame.setMoneyWon(blackJackGame.getBet());
        }
        if (standAfterDoubleOr21) {
            return new BlackJackGameResponse(
                    blackJackGame.getPlayerHand(),
                    blackJackGame.getDealerHand(),
                    cardDrawn,
                    blackJackGameResult,
                    blackJackGame.getMoneyWon()
            );
        } else {
            return new BlackJackGameResponse(
                    blackJackGame.getPlayerHand(),
                    blackJackGame.getDealerHand(),
                    blackJackGameResult,
                    blackJackGame.getMoneyWon()
            );
        }
    }

    private BlackJackGameResponse splitResponse(String cardDrawn) {
        if (!blackJackGame.isPlayerHandStand()) {
            return new BlackJackGameResponse(
                    blackJackGame.getPlayerHand(),
                    blackJackGame.getDealerHand(),
                    cardDrawn,
                    BlackJackGameResult.UNRESOLVED,
                    blackJackGame.getMoneyWon(),
                    false,
                    blackJackGame.getSplitHand()
            );
        } else if (!blackJackGame.isSplitHandStand()) {
            BlackJackGameResult blackJackGameResultHand1 = BlackJackGameResult.UNRESOLVED;
            if (blackJackGame.calculateHandValue(true, false) > 21) {
                blackJackGameResultHand1 = BlackJackGameResult.LOST;
            }
            return new BlackJackGameResponse(
                    blackJackGame.getPlayerHand(),
                    blackJackGame.getDealerHand(),
                    blackJackGameResultHand1,
                    blackJackGame.getMoneyWon(),
                    blackJackGame.calculateHandValue(true, false) == 21,
                    blackJackGame.getSplitHand()
            );
        } else {
            while (blackJackGame.calculateHandValue(false, false) < 17) {
                blackJackGame.getDealerHand().add(getCard());
            }
            BlackJackGameResult handOne = getBlackJackGameResult(blackJackGame.calculateHandValue(true, false), blackJackGame.calculateHandValue(false, false));
            BlackJackGameResult handTwo = getBlackJackGameResult(blackJackGame.calculateHandValue(false, true), blackJackGame.calculateHandValue(false, false));

            if (handOne == BlackJackGameResult.WIN) {
                blackJackGame.setMoneyWon(blackJackGame.getBet() * 2);
            } else if (handOne == BlackJackGameResult.DRAW) {
                blackJackGame.setMoneyWon(blackJackGame.getBet());
            }

            if (handTwo == BlackJackGameResult.WIN) {
                blackJackGame.setMoneyWonSplit(blackJackGame.getBetSplit() * 2);
            } else if (handTwo == BlackJackGameResult.DRAW) {
                blackJackGame.setMoneyWonSplit(blackJackGame.getBetSplit());
            }

            return new BlackJackGameResponse(
                    blackJackGame.getPlayerHand(),
                    blackJackGame.getDealerHand(),
                    handOne,
                    cardDrawn,
                    blackJackGame.getMoneyWon(),
                    blackJackGame.getSplitHand(),
                    blackJackGame.getMoneyWonSplit(),
                    handTwo
            );
        }
    }

    private static BlackJackGameResult getBlackJackGameResult(int playerScore, int dealerScore) {
        BlackJackGameResult blackJackGameResult;
        if (playerScore > 21) blackJackGameResult = BlackJackGameResult.LOST;
        else if (dealerScore > 21) blackJackGameResult = BlackJackGameResult.WIN;
        else if (playerScore > dealerScore) blackJackGameResult = BlackJackGameResult.WIN;
        else if (playerScore < dealerScore) blackJackGameResult = BlackJackGameResult.LOST;
        else blackJackGameResult = BlackJackGameResult.DRAW;
        return blackJackGameResult;
    }
}
