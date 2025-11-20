package com.absoluteCasino.control.games.makao;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class MakaoGameTest {

    private MakaoGame game;
    private MakaoGameRoom room;

    @BeforeEach
    public void setUp() {
        game = new MakaoGame();
        room = new MakaoGameRoom("test_room");
    }

    @Test
    public void testCanPlayCardSameValue() {
        // Można zagrać kartę o tej samej wartości
        assertTrue(game.canPlayCard("2H", "2D", null, null));
        assertTrue(game.canPlayCard("KS", "KC", null, null));
    }

    @Test
    public void testCanPlayCardSameSuit() {
        // Można zagrać kartę o tym samym kolorze
        assertTrue(game.canPlayCard("2H", "5H", null, null));
        assertTrue(game.canPlayCard("KS", "2S", null, null));
    }

    @Test
    public void testAceAllowsSuitRequirement() {
        // As pozwala na zignorowanie wymagań kolorystycznych
        assertTrue(game.canPlayCard("AH", "2D", null, null));
        game.setTableCard("2D");
        game.setCurrentSuit("H");
        assertTrue(game.canPlayCard("5H", "2D", "H", null));
        assertFalse(game.canPlayCard("5D", "2D", "H", null));
    }

    @Test
    public void testJackNumberRequirement() {
        // Walet musi zazwyczaj pasować do wartości/koloru
        assertTrue(game.canPlayCard("JH", "2H", null, null)); // pasuje kolorystycznie
        game.setRequiredNumber('7');
        assertTrue(game.canPlayCard("7D", "2H", null, null));
        assertFalse(game.canPlayCard("8D", "2H", null, null));
    }

    @Test
    public void testDrawStackingLogic() {
        // symulacja zagrania 2, a potem kolejnej 2
        game.setTableCard("2H");
        game.setDrawType("2");
        game.setPendingDrawCount(2);
        assertTrue(game.canPlayCard("2D", "2H", null, null));
        assertFalse(game.canPlayCard("3D", "2H", null, null));
        // symulacja stosu 3
        game.setDrawType("3");
        game.setPendingDrawCount(3);
        assertTrue(game.canPlayCard("3S", "2H", null, null));
    }

    @Test
    public void testInitializeDeck() {
        // Sprawdzenie, czy talia zawiera cztery kolory po 13 wartościach (52)
        room.initializeDeck();
        assertEquals(52, room.getDeckSize()); // 52 karty
    }

    @Test
    public void testDrawCardReducesDeck() {
        // Sprawdzenie, czy dobieranie karty zmniejsza rozmiar talii
        room.initializeDeck();
        String card = room.drawCard();
        assertNotNull(card);
        assertEquals(51, room.getDeckSize());
    }

    @Test
    public void testPlayerCanJoinRoom() {
        boolean added = room.addPlayer(new MakaoPlayer(1, "Player1"));
        assertTrue(added);
        assertEquals(1, room.getPlayers().size());
    }

    @Test
    public void testTwoPlayersCanJoinRoom() {
        room.addPlayer(new MakaoPlayer(1, "Player1"));
        room.addPlayer(new MakaoPlayer(2, "Player2"));
        assertTrue(room.isFull());
        assertEquals(2, room.getPlayers().size());
    }

    @Test
    public void testCannotAddThirdPlayer() {
        room.addPlayer(new MakaoPlayer(1, "Player1"));
        room.addPlayer(new MakaoPlayer(2, "Player2"));
        boolean added = room.addPlayer(new MakaoPlayer(3, "Player3"));
        assertFalse(added);
        assertEquals(2, room.getPlayers().size());
    }

    @Test
    public void testDrawCard() {
        room.initializeDeck();
        String card = room.drawCard();
        assertNotNull(card);
        assertEquals(51, room.getDeckSize());
    }

    @Test
    public void testRemovePlayer() {
        room.addPlayer(new MakaoPlayer(1, "Player1"));
        room.removePlayer(1);
        assertTrue(room.isEmpty());
    }

}
