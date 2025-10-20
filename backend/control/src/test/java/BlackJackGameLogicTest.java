import com.absoluteCasino.control.games.blackjack.BlackJackGame;
import com.absoluteCasino.control.games.blackjack.BlackJackGameResponse;
import com.absoluteCasino.control.games.blackjack.BlackJackGameResult;
import com.absoluteCasino.control.games.blackjack.BlackJackGameSession;
import com.absoluteCasino.control.utils.CardsShoe;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.LinkedList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
class BlackJackGameSessionTest {

    @Test
    void dealCards_PlayerBlackjack_ShouldReturnProperResult() throws Exception {
        BlackJackGameSession session = new BlackJackGameSession("", 1);
        injectTestCards(session, List.of("AH", "KH", "2D", "3S", "QS"));

        BlackJackGameResponse response = session.dealCards(100L, true);

        assertEquals(BlackJackGameResult.BLACKJACK, response.getResult());
        assertEquals(250L, response.getMoneyWon());
    }

    @Test
    void dealCards_BothBlackjack_ShouldReturnDraw() throws Exception {
        BlackJackGameSession session = new BlackJackGameSession("", 1);
        injectTestCards(session, List.of("AH", "KH", "AS", "KS", "QS"));

        BlackJackGameResponse response = session.dealCards(100L, true);

        assertEquals(BlackJackGameResult.DRAW, response.getResult());
        assertEquals(100L, response.getMoneyWon());
        assertTrue(response.getDealerCards().size() >= 2);
    }

    @Test
    void hit_PlayerBust_ShouldReturnLost() throws Exception {
        BlackJackGameSession session = new BlackJackGameSession("", 1);
        injectTestCards(session, List.of("TH", "6D", "2S", "7C", "KH", "3D"));

        session.dealCards(100L, true);

        BlackJackGameResponse response = session.hit(false);

        assertEquals(BlackJackGameResult.LOST, response.getResult());
        assertTrue(response.getPlayerCards().size() > 2);
    }

    @Test
    void split_ShouldCreateTwoHands() throws Exception {
        BlackJackGameSession session = new BlackJackGameSession("", 1);
        injectTestCards(session, List.of("8H", "8D", "2S", "3C", "4D", "5H", "6S"));

        session.dealCards(100L, true);

        BlackJackGameResponse response = session.split();

        assertEquals(2, response.getPlayerCards().size());
        assertEquals(2, response.getPlayerSplitCards().size());
        assertEquals(BlackJackGameResult.UNRESOLVED, response.getResult());
    }

    @Test
    void stand_DealerBust_ShouldReturnWin() throws Exception {
        BlackJackGameSession session = new BlackJackGameSession("", 1);
        injectTestCards(session, List.of("TH", "7D", "6S", "8C", "KH", "2D"));

        session.dealCards(100L, true);

        BlackJackGameResponse response = session.stand(false, "");

        assertEquals(BlackJackGameResult.WIN, response.getResult());
        assertEquals(200L, response.getMoneyWon());
        assertTrue(response.getDealerCards().size() >= 3);
    }

    private void injectTestCards(BlackJackGameSession session, List<String> cards) throws Exception {
        CardsShoe riggedShoe = new CardsShoe();

        Field shoeField = CardsShoe.class.getDeclaredField("shoe");
        shoeField.setAccessible(true);

        LinkedList<String> testShoe = new LinkedList<>(cards);
        while (testShoe.size() < 140) {
            testShoe.addLast("2C");
        }
        shoeField.set(riggedShoe, testShoe);

        Field cardsLeftField = CardsShoe.class.getDeclaredField("cardsLeft");
        cardsLeftField.setAccessible(true);
        cardsLeftField.set(riggedShoe, testShoe.size());

        Field sessionShoeField = BlackJackGameSession.class.getDeclaredField("cardsShoe");
        sessionShoeField.setAccessible(true);
        sessionShoeField.set(session, riggedShoe);
    }
}

@ExtendWith(MockitoExtension.class)
class BlackJackGameTest {

    @Test
    void calculateHandValue_WithAces_ShouldAdjustProperly() {
        BlackJackGame game = new BlackJackGame();
        game.setPlayerHand(List.of("AH", "8H", "3D"));
        int value = game.calculateHandValue(true, false);

        assertEquals(12, value);
    }

    @Test
    void calculateHandValue_Blackjack_ShouldReturn21() {
        BlackJackGame game = new BlackJackGame();
        game.setPlayerHand(List.of("AH", "KH"));

        int value = game.calculateHandValue(true, false);

        assertEquals(21, value);
    }

    @Test
    void isSplitableOn10_ShouldDetectTenValueCards() {
        BlackJackGame game = new BlackJackGame();
        game.setPlayerHand(List.of("KH", "QH"));

        boolean result = game.isSplitableOn10();

        assertTrue(result);
    }
}