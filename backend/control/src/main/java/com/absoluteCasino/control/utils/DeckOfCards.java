package com.absoluteCasino.control.utils;

import java.util.ArrayList;
import java.util.List;


public class DeckOfCards {


    public static List<String> createDeck() {
        String[] suits = {"H", "D", "C", "S"};
        String[] values = {"2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"};

        List<String> deck = new ArrayList<>();

        for (String value : values) {
            for (String suit : suits) {
                deck.add(value + suit);
            }
        }

        return deck;
    }

}
