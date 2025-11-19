package com.absoluteCasino.control.utils;

import lombok.Getter;

import java.util.*;

import static com.absoluteCasino.control.utils.DeckOfCards.createDeck;


public class CardsShoe {
    public static int NUMBER_OF_DECKS = 5;
    private LinkedList<String> shoe;
    @Getter
    private int cardsLeft;

    public CardsShoe() {
        shoe = new LinkedList<>();
        cardsLeft = 260;
        insertCards(NUMBER_OF_DECKS);
    }

    public CardsShoe(int numberOfDecks) {
        shoe = new LinkedList<>();
        cardsLeft = 52;
        insertCards(1);
    }

    private void insertCards(int numberOfDecks) {
        List<String> newDeck = createDeck();
        for (int i = 0; i < NUMBER_OF_DECKS; i++) {
            shoe.addAll(newDeck);
        }
        Collections.shuffle(shoe);
    }

    public String getCard() {
        if (cardsLeft == 0) {
            throw new IllegalStateException("Shoe is empty");
        }
        cardsLeft--;
        return shoe.removeFirst();
    }

}
