package com.absoluteCasino.control.games.baccarat;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;


@AllArgsConstructor
@Getter
public class BaccaratGameResponse {

    @JsonProperty("is_over")
    Boolean isOver;

    @JsonProperty("player_cards")
    List<String> playerCards;

    @JsonProperty("dealer_cards")
    List<String> dealerCards;
    @JsonProperty("money_won")
    Long moneyWon;

    @JsonProperty("players_result")
    BaccaratGameResult playersResult;

}
