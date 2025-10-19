import com.absoluteCasino.control.games.baccarat.*;
import com.absoluteCasino.control.utils.CardsShoe;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.LinkedList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class BaccaratGameSessionTest {

    @Test
    void dealCards_PlayerWin_ShouldReturnProperResult() throws Exception {
        BaccaratGameSession session = new BaccaratGameSession(1);
        injectTestCards(session, List.of("8S", "2D", "KH", "3S"));

        BaccaratGameResponse response = session.dealCards(BaccaratPlayersChoice.PUNTO, 100L);

        assertTrue(response.getIsOver());
        assertEquals(BaccaratGameResult.WIN, response.getPlayersResult());
        assertEquals(200L, response.getMoneyWon());
    }

    @Test
    void dealCards_Tie_ShouldReturnProperPayout() throws Exception {
        BaccaratGameSession session = new BaccaratGameSession(1);
        injectTestCards(session, List.of("8S", "8D", "KH","QS"));

        BaccaratGameResponse response = session.dealCards(BaccaratPlayersChoice.TIE, 100L);

        assertTrue(response.getIsOver());
        assertEquals(BaccaratGameResult.WIN, response.getPlayersResult());
        assertEquals(900L, response.getMoneyWon());
    }

    @Test
    void hit_ThirdCardRules_ShouldFollowProperLogic() throws Exception {
        BaccaratGameSession session = new BaccaratGameSession(1);
        injectTestCards(session, List.of("3S", "4D", "2H", "2S", "6C"));

        BaccaratGameResponse response = session.dealCards(BaccaratPlayersChoice.PUNTO, 100L);

        assertTrue(response.getIsOver());
        assertEquals(3, response.getPlayerCards().size());
        assertEquals(3, response.getDealerCards().size());
    }

    private void injectTestCards(BaccaratGameSession session, List<String> cards) throws Exception {
        CardsShoe riggedShoe = new CardsShoe();

        Field shoeField = CardsShoe.class.getDeclaredField("shoe");
        shoeField.setAccessible(true);

        LinkedList<String> testShoe = new LinkedList<>(cards);
        while(testShoe.size() < 130) {
            testShoe.addLast("2C");
        }

        shoeField.set(riggedShoe, testShoe);

        Field cardsLeftField = CardsShoe.class.getDeclaredField("cardsLeft");
        cardsLeftField.setAccessible(true);
        cardsLeftField.set(riggedShoe, testShoe.size());

        Field sessionShoeField = BaccaratGameSession.class.getDeclaredField("cardsShoe");
        sessionShoeField.setAccessible(true);
        sessionShoeField.set(session, riggedShoe);
    }
}
