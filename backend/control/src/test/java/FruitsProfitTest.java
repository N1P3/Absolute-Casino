import com.absoluteCasino.control.games.fruitogedon.FruitsGameConfig;
import com.absoluteCasino.control.games.fruitogedon.FruitsGameSession;
import com.absoluteCasino.control.games.slot.SlotGameLogic;
import com.absoluteCasino.control.games.slot.SlotGameResultDTO;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class FruitsProfitTest {
    private final Long BET_AMOUNT = 10l;

    @Test
    void fruitsProfitAt70Percentage() {
        FruitsGameSession fruitsGameSession = new FruitsGameSession(1);

        ArrayList<Double> wins = new ArrayList<>();
        ArrayList<Long> bets = new ArrayList<>();

        for (int i = 0; i < 1_000_000; i++) {
            bets.add(BET_AMOUNT);
            SlotGameResultDTO bet = fruitsGameSession.spin(BET_AMOUNT);
            wins.add(BET_AMOUNT * bet.getMultiplier());
        }

        double profit = wins.stream().mapToDouble(e -> e).sum() / bets.stream().mapToDouble(e -> e).sum() * 100;
        System.out.println(profit);
        assertTrue((profit > 65) && (profit < 75));

    }
}
