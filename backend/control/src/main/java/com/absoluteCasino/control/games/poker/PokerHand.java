package com.absoluteCasino.control.games.poker;

import com.absoluteCasino.games.user.User;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class PokerHand {

    User user;

    List<String> cards = new ArrayList<>();

}
