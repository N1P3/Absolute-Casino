package com.absoluteCasino.control.games.makao;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.Arrays;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

public class MakaoGameTest {

    private MakaoGame game;
    private MakaoGameRoom room;

    @BeforeEach
    public void setUp() {
        game = new MakaoGame();
        game.setTableCard("5H"); // Default table card for tests
        room = new MakaoGameRoom("test_room");
    }

    @Test
    public void testCanPlayCardSameValue() {
        // Można zagrać kartę o tej samej wartości
        assertTrue(game.canPlayCard("2H", "2D", null, 1));
        assertTrue(game.canPlayCard("KS", "KC", null, 1));
    }

    @Test
    public void testCanPlayCardSameSuit() {
        // Można zagrać kartę o tym samym kolorze
        assertTrue(game.canPlayCard("2H", "5H", null, 1));
        assertTrue(game.canPlayCard("KS", "2S", null, 1));
    }

    @Test
    public void testAceCanAlwaysBePlayed() {
        // As można zawsze zagrać
        assertTrue(game.canPlayCard("AH", "2D", null, 1));
        assertTrue(game.canPlayCard("AS", "KH", null, 1));
    }

    @Test
    public void testAceWithSuitRequirement() {
        // Po zagraniu Asa, wymagany jest określony kolor
        game.setCurrentSuit("H");
        assertTrue(game.canPlayCard("5H", "AD", "H", 1));
        assertFalse(game.canPlayCard("5D", "AD", "H", 1));
        // As nadal można zagrać
        assertTrue(game.canPlayCard("AS", "AD", "H", 1));
    }

    @Test
    public void testJackNumberRequirement() {
        // Po zagraniu Waleta, wymagana jest określona liczba
        game.setRequiredNumber('7');
        assertTrue(game.canPlayCard("7D", "JH", null, 1));
        assertTrue(game.canPlayCard("7S", "JH", null, 1));
        assertFalse(game.canPlayCard("8D", "JH", null, 1));
    }

    @Test
    public void testJackCanBePlayedOnSameSuitOrJack() {
        // Walet pasuje do koloru lub do innego Waleta
        assertTrue(game.canPlayCard("JH", "5H", null, 1)); // Ten sam kolor
        assertTrue(game.canPlayCard("JD", "JS", null, 1)); // Walet na Waleta
        assertFalse(game.canPlayCard("JH", "5S", null, 1)); // Różny kolor
    }

    @Test
    public void testDrawStackingWith2() {
        // Stackowanie 2
        game.setDrawType("2");
        game.setPendingDrawCount(2);
        assertTrue(game.canPlayCard("2D", "2H", null, 1));
        assertFalse(game.canPlayCard("3D", "2H", null, 1));
        assertFalse(game.canPlayCard("5D", "2H", null, 1));
    }

    @Test
    public void testDrawStackingWith3() {
        // Stackowanie 3
        game.setDrawType("3");
        game.setPendingDrawCount(3);
        assertTrue(game.canPlayCard("3S", "3H", null, 1));
        assertFalse(game.canPlayCard("2S", "3H", null, 1));
    }

    @Test
    public void testDrawStackingWithKingHeartSpade() {
        // Stackowanie K♥/♠
        game.setDrawType("K");
        game.setPendingDrawCount(5);
        assertTrue(game.canPlayCard("KH", "KS", null, 1));
        assertTrue(game.canPlayCard("KS", "KH", null, 1));
        assertFalse(game.canPlayCard("KD", "KH", null, 1)); // K♦ nie stackuje
        assertFalse(game.canPlayCard("KC", "KH", null, 1)); // K♣ nie stackuje
    }

    @Test
    public void testSkipTurnWith4() {
        // Gdy gracz ma skip, może zagrać tylko 4
        game.setPlayerToSkip(1);
        game.setPendingSkipTurns(1);
        assertTrue(game.canPlayCard("4H", "5H", null, 1));
        assertFalse(game.canPlayCard("5H", "5D", null, 1)); // Normalna karta niedozwolona
    }

    @Test
    public void testSkipTurnRequiresPendingSkips() {
        // Skip działa tylko gdy pendingSkipTurns > 0
        game.setPlayerToSkip(1);
        game.setPendingSkipTurns(0); // Brak aktywnych skipów
        // Gracz może zagrać normalnie
        assertTrue(game.canPlayCard("5H", "5D", null, 1));
    }

    @Test
    public void testPlayCardsWithAce() {
        // Zagranie Asa wymaga wyboru koloru
        List<String> cards = Arrays.asList("AH");
        MakaoGame.PlayResult result = game.playCards(cards, "D", null, 1, 2);
        assertTrue(result.success);
        assertEquals("D", game.getCurrentSuit());
        assertEquals(2, game.getRequirementTurnsLeft());
    }

    @Test
    public void testPlayCardsWithJack() {
        // Zagranie Waleta wymaga wyboru liczby
        List<String> cards = Arrays.asList("JH");
        MakaoGame.PlayResult result = game.playCards(cards, null, "7", 1, 2);
        assertTrue(result.success);
        assertEquals('7', game.getRequiredNumber());
        assertEquals(2, game.getRequirementTurnsLeft());
    }

    @Test
    public void testPlayCardsWithMultipleSameRank() {
        // Zagranie wielu kart tej samej wartości
        game.setTableCard("5H");
        List<String> cards = Arrays.asList("5D", "5S");
        MakaoGame.PlayResult result = game.playCards(cards, null, null, 1, 2);
        assertTrue(result.success);
        assertEquals("5S", game.getTableCard()); // Ostatnia karta na stole
    }

    @Test
    public void testPlayCardsDifferentRanksFails() {
        // Zagranie kart różnych wartości powinno zawieść
        List<String> cards = Arrays.asList("5D", "6S");
        MakaoGame.PlayResult result = game.playCards(cards, null, null, 1, 2);
        assertFalse(result.success);
        assertEquals("Karty muszą być tej samej wartości", result.errorMessage);
    }

    @Test
    public void testPlayCards4Counter() {
        // Zagranie 4 jako counter
        game.setPlayerToSkip(1);
        game.setPendingSkipTurns(1);
        game.setTableCard("4H");
        List<String> cards = Arrays.asList("4D");
        MakaoGame.PlayResult result = game.playCards(cards, null, null, 1, 2);
        assertTrue(result.success);
        assertEquals(2, game.getPlayerToSkip()); // Przekazano na gracza 2
        assertEquals(2, game.getPendingSkipTurns()); // Zwiększono o 1
    }

    @Test
    public void testDrawCards() {
        // Dobieranie bez stacka
        int toDraw = game.drawCards();
        assertEquals(1, toDraw);
        
        // Dobieranie ze stackiem
        game.setPendingDrawCount(5);
        game.setDrawType("2");
        toDraw = game.drawCards();
        assertEquals(5, toDraw);
        assertEquals(0, game.getPendingDrawCount()); // Stack wyczyszczony
        assertNull(game.getDrawType());
    }

    @Test
    public void testSkipTurnSuccess() {
        // Pomijanie tury gdy jest wymagane
        game.setPlayerToSkip(1);
        game.setPendingSkipTurns(2);
        MakaoGame.PlayResult result = game.skipTurn(1);
        assertTrue(result.success);
        assertEquals(1, game.getPendingSkipTurns()); // Zmniejszono o 1
    }

    @Test
    public void testSkipTurnClearsWhenZero() {
        // Pomijanie ostatniej tury czyści penalty
        game.setPlayerToSkip(1);
        game.setPendingSkipTurns(1);
        MakaoGame.PlayResult result = game.skipTurn(1);
        assertTrue(result.success);
        assertNull(game.getPlayerToSkip());
        assertEquals(0, game.getPendingSkipTurns());
    }

    @Test
    public void testSkipTurnFailsWhenNotRequired() {
        // Próba pomijania gdy nie jest wymagane
        MakaoGame.PlayResult result = game.skipTurn(1);
        assertFalse(result.success);
        assertEquals("Nie musisz pomijać tury", result.errorMessage);
    }

    @Test
    public void testRequirementTurnsDecrement() {
        // Wymagania (Ace/Jack) trwają 2 tury
        game.setCurrentSuit("H");
        game.setRequirementTurnsLeft(2);
        
        // Po zagraniu normalnej karty, licznik spada
        List<String> cards = Arrays.asList("5H");
        game.playCards(cards, null, null, 1, 2);
        assertEquals(1, game.getRequirementTurnsLeft());
        
        // Po kolejnej turze, wymaganie znika
        cards = Arrays.asList("6H");
        game.playCards(cards, null, null, 1, 2);
        assertEquals(0, game.getRequirementTurnsLeft());
        assertNull(game.getCurrentSuit());
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
