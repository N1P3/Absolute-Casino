package com.absoluteCasino.control.games.poker;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class HoldemPlayer {
    private int userId;
    private List<String> holeCards;
}
