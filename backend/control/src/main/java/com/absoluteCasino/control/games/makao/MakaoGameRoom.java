package com.absoluteCasino.control.games.makao;

import lombok.Getter;
import lombok.Setter;

import java.util.*;

@Setter
@Getter
public class MakaoGameRoom {
    private String roomId;
    private List<MakaoPlayer> players = new ArrayList<>();
    private MakaoGame game;
    private int currentPlayerIndex = 0;
    private LinkedList<String> deck;
    private int deckSize;
    private boolean gameActive = false;
    private MakaoPlayer winner;

    public MakaoGameRoom(String roomId) {
        this.roomId = roomId;
        this.game = new MakaoGame();
        this.deck = new LinkedList<>();
        this.deckSize = 0;
    }

    public synchronized boolean addPlayer(MakaoPlayer player) {
        if (players.size() >= 2) return false;
        players.add(player);
        return true;
    }

    public synchronized void removePlayer(Integer userId) {
        players.removeIf(p -> p.getUserId().equals(userId));
    }

    public boolean isFull() { return players.size() == 2; }
    public boolean isEmpty() { return players.isEmpty(); }

    public void initializeDeck() {
        deck.clear();
        String[] suits = {"H", "D", "C", "S"};
        String[] values = {"2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"};
        for (String v : values) {
            for (String s : suits) {
                deck.add(v + s);
            }
        }
        Collections.shuffle(deck);
        deckSize = deck.size();
    }

    public String drawCard() {
        if (deck.isEmpty()) initializeDeck();
        deckSize--;
        return deck.removeFirst();
    }

    public MakaoPlayer getNextPlayer() {
        currentPlayerIndex = (currentPlayerIndex + 1) % players.size();
        return players.get(currentPlayerIndex);
    }

    public MakaoPlayer getCurrentPlayer() { return players.get(currentPlayerIndex); }

    public MakaoPlayer getPlayerByUserId(Integer userId) {
        return players.stream().filter(p -> p.getUserId().equals(userId)).findFirst().orElse(null);
    }

    public boolean isGameOver() { return players.stream().anyMatch(p -> p.getHand().isEmpty()); }

    public MakaoPlayer getWinner() { return players.stream().filter(p -> p.getHand().isEmpty()).findFirst().orElse(null); }
}

