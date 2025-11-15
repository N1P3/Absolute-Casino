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
        assertTrue(game.canPlayCard("2H", "2D", null));
        assertTrue(game.canPlayCard("KS", "KC", null));
    }

    @Test
    public void testCanPlayCardSameSuit() {
        // Można zagrać kartę o tym samym kolorze
        assertTrue(game.canPlayCard("2H", "5H", null));
        assertTrue(game.canPlayCard("KS", "2S", null));
    }

    @Test
    public void testAceAllowsSuitRequirement() {
        // As pozwala na zignorowanie wymagań kolorystycznych
        assertTrue(game.canPlayCard("AH", "2D", null));
        game.setTableCard("2D");
        game.setCurrentSuit("H");
        assertTrue(game.canPlayCard("5H", "2D", "H"));
        assertFalse(game.canPlayCard("5D", "2D", "H"));
    }

    @Test
    public void testJackNumberRequirement() {
        // Walet musi zazwyczaj pasować do wartości/koloru
        assertTrue(game.canPlayCard("JH", "2H", null)); // pasuje kolorystycznie
        game.setRequiredNumber('7');
        assertTrue(game.canPlayCard("7D", "2H", null));
        assertFalse(game.canPlayCard("8D", "2H", null));
    }

    @Test
    public void testJokerAlwaysPlayable() {
        // Joker zawsze można zagrać
        game.setTableCard("5H");
        assertTrue(game.canPlayCard("XH", "5H", null));
        game.setCurrentSuit("S");
        assertTrue(game.canPlayCard("XD", "5H", "S")); // joker pod wymaganiami kolorystycznymi
        game.setRequiredNumber('9');
        assertTrue(game.canPlayCard("XC", "5H", null)); // joker pod wymaganiami liczbowymi
        game.setDrawType("2");
        game.setPendingDrawCount(2);
        assertTrue(game.canPlayCard("XS", "5H", null)); // joker pod wymaganiami stosu dobierania
    }

    @Test
    public void testDrawStackingLogic() {
        // symulacja zagrania 2, a potem kolejnej 2
        game.setTableCard("2H");
        game.setDrawType("2");
        game.setPendingDrawCount(2);
        assertTrue(game.canPlayCard("2D", "2H", null));
        assertFalse(game.canPlayCard("3D", "2H", null));
        // symulacja stosu 3
        game.setDrawType("3");
        game.setPendingDrawCount(3);
        assertTrue(game.canPlayCard("3S", "2H", null));
    }

    @Test
    public void testInitializeDeck() {
        // Sprawdzenie, czy talia zawiera jokery
        room.initializeDeck();
        assertEquals(56, room.getDeckSize()); // 52 + 4 jokery
    }

    @Test
    public void testDrawCardReducesDeck() {
        // Sprawdzenie, czy dobieranie karty zmniejsza rozmiar talii
        room.initializeDeck();
        String card = room.drawCard();
        assertNotNull(card);
        assertEquals(55, room.getDeckSize());
    }

    @Test
    public void testPlayerCanJoinRoom() {
        boolean added = room.addPlayer(1, "Player1");
        assertTrue(added);
        assertEquals(1, room.getPlayers().size());
    }

    @Test
    public void testTwoPlayersCanJoinRoom() {
        room.addPlayer(1, "Player1");
        room.addPlayer(2, "Player2");
        assertTrue(room.isFull());
        assertEquals(2, room.getPlayers().size());
    }

    @Test
    public void testCannotAddThirdPlayer() {
        room.addPlayer(1, "Player1");
        room.addPlayer(2, "Player2");
        boolean added = room.addPlayer(3, "Player3");
        assertFalse(added);
        assertEquals(2, room.getPlayers().size());
    }

    @Test
    public void testDrawCard() {
        room.initializeDeck();
        String card = room.drawCard();
        assertNotNull(card);
        assertEquals(55, room.getDeckSize());
    }

    @Test
    public void testRemovePlayer() {
        room.addPlayer(1, "Player1");
        room.removePlayer(1);
        assertTrue(room.isEmpty());
    }
    // Updated MakaoGameTest.java additions for joker stacking
// Add these test methods or merge into existing test class.

    @Test
    public void testJokerCanStartStackAsTwo() {
        MakaoGame game = new MakaoGame();
        game.setTableCard("5H");
        // Joker playable
        assertTrue(game.canPlayCard("XH", "5H", null));
        // Simulate representation as '2' starting stack
        game.setDrawType("2");
        game.setPendingDrawCount(2);
        // Now only 2 or Joker allowed
        assertTrue(game.canPlayCard("2D", "5H", null));
        assertTrue(game.canPlayCard("XD", "5H", null)); // joker continuation
        assertFalse(game.canPlayCard("3D", "5H", null));
    }

    @Test
    public void testJokerContinuationOnKingStack() {
        MakaoGame game = new MakaoGame();
        game.setTableCard("KH");
        game.setDrawType("K");
        game.setPendingDrawCount(5);
        assertTrue(game.canPlayCard("KS", "KH", null)); // continue
        assertTrue(game.canPlayCard("XH", "KH", null)); // joker allowed
        assertFalse(game.canPlayCard("2H", "KH", null));
    }
}
