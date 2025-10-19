import com.absoluteCasino.control.games.mummy.MummyGameConfig;
import com.absoluteCasino.control.games.mummy.MummyGameSession;
import com.absoluteCasino.control.games.slot.Bonus;
import com.absoluteCasino.control.games.slot.SlotGameLogic;
import com.absoluteCasino.control.games.slot.SlotGameResultDTO;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class MummyProfitTest {
    private final long BET_AMOUNT = 10l;

    @Test
    void mummyProfitAt70Percentage() {
        MummyGameSession mummyGameSession = new MummyGameSession(1);

        ArrayList<Double> wins = new ArrayList<>();
        ArrayList<Long> bets = new ArrayList<>();

        Bonus bonus = null;
        for (int i = 0; i < 1_000_000; i++) {
            bets.add(BET_AMOUNT);
            SlotGameResultDTO bet = mummyGameSession.spin(BET_AMOUNT);
            bonus = bet.getBonus();
            wins.add(BET_AMOUNT * bet.getMultiplier());
        }

        double profit = wins.stream().mapToDouble(e -> e).sum() / bets.stream().mapToDouble(e -> e).sum() * 100;
        System.out.println(profit);
        assertTrue((profit > 65) && (profit < 75));

    }
}
