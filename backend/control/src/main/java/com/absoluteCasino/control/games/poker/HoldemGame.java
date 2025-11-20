package com.absoluteCasino.control.games.poker;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class HoldemGame {
    private List<HoldemPlayer> players = new ArrayList<>();
    private List<String> communityCards = new ArrayList<>();
}
