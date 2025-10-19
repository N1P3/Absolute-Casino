package com.absoluteCasino.control.games.blackjack;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Getter
public class BlackJackGameResponse {

    @JsonProperty("player_cards")
    List<String> playerCards;

    @JsonProperty("dealer_cards")
    List<String> dealerCards;

    @JsonProperty("card_hit")
    String cardHit;

    @JsonProperty("result")
    BlackJackGameResult result;

    @JsonProperty("money_won")
    Long moneyWon;

    @JsonProperty("doublable")
    boolean doublable;

    @JsonProperty("splitable")
    boolean splitable;

    @JsonProperty("player_split_cards")
    List<String> playerSplitCards;

    @JsonProperty("money_won_split")
    Long moneyWonSplit;

    @JsonProperty("result_split")
    BlackJackGameResult resultSplit;

    public BlackJackGameResponse(List<String> playerCards, List<String> dealerCards, BlackJackGameResult result, Long moneyWon, boolean doublable, boolean splitable) {
        this.playerCards = playerCards;
        this.dealerCards = dealerCards;
        this.result = result;
        this.moneyWon = moneyWon;
        this.doublable = doublable;
        this.splitable = splitable;
    }

    public BlackJackGameResponse(List<String> playerCards, List<String> dealerCards, BlackJackGameResult result, Long moneyWon, boolean doublable, List<String> playerSplitCards) {
        this.playerCards = playerCards;
        this.dealerCards = dealerCards;
        this.result = result;
        this.moneyWon = moneyWon;
        this.doublable = doublable;
        this.playerSplitCards = playerSplitCards;
    }

    public BlackJackGameResponse(List<String> playerCards, List<String> dealerCards, BlackJackGameResult result, String cardHit, Long moneyWon, List<String> playerSplitCards, Long moneyWonSplit, BlackJackGameResult resultSplit) {
        this.playerCards = playerCards;
        this.dealerCards = dealerCards;
        this.result = result;
        this.cardHit = cardHit;
        this.moneyWon = moneyWon;
        this.playerSplitCards = playerSplitCards;
        this.moneyWonSplit = moneyWonSplit;
        this.resultSplit = resultSplit;
    }

    public BlackJackGameResponse(List<String> playerCards, List<String> dealerCards, String cardHit, BlackJackGameResult result, Long moneyWon, boolean doublable, List<String> playerSplitCards) {
        this.playerCards = playerCards;
        this.dealerCards = dealerCards;
        this.cardHit = cardHit;
        this.result = result;
        this.moneyWon = moneyWon;
        this.doublable = doublable;
        this.playerSplitCards = playerSplitCards;

    }

    public BlackJackGameResponse(List<String> playerCards, List<String> dealerCards, String cardHit, BlackJackGameResult result, Long moneyWon) {
        this.playerCards = playerCards;
        this.dealerCards = dealerCards;
        this.cardHit = cardHit;
        this.result = result;
        this.moneyWon = moneyWon;
    }

    public BlackJackGameResponse(List<String> playerCards, List<String> dealerCards, BlackJackGameResult result, Long moneyWon) {
        this.playerCards = playerCards;
        this.dealerCards = dealerCards;
        this.result = result;
        this.moneyWon = moneyWon;
    }
}
