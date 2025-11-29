package com.absoluteCasino.control.games.makao;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Setter
@Getter
public class MakaoPlayer {
    private Integer userId;
    private String userName;
    private List<String> hand = new ArrayList<>();
    private Long bet = 0L;
    private boolean isReady = false;
    private boolean isAi = false;

    public MakaoPlayer(Integer userId, String userName) {
        this.userId = userId;
        this.userName = userName;
    }

    /**
     * Dodaje kartę do ręki gracza
     */
    public void addCard(String card) {
        hand.add(card);
    }

    /**
     * Usuwa kartę z ręki gracza
     */
    public void removeCard(String card) {
        hand.remove(card);
    }

    /**
     * Usuwa kartę na określonym indeksie
     */
    public String removeCardAt(int index) {
        if (index < 0 || index >= hand.size()) {
            throw new IndexOutOfBoundsException("Invalid card index");
        }
        return hand.remove(index);
    }

    /**
     * Czyszcze rękę gracza
     */
    public void clearHand() {
        hand.clear();
    }

    /**
     * Pobiera ilość kart w ręce
     */
    public int getHandSize() {
        return hand.size();
    }
}

