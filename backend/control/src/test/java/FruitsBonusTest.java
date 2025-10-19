import com.absoluteCasino.control.games.mummy.MummyGameConfig;
import com.absoluteCasino.control.games.slot.Bonus;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

public class FruitsBonusTest {
    @Test
    void mummySuperBonusWorkProperlyOnAllCases() {
        MummyGameConfig mummyGameConfig = new MummyGameConfig();

        List<int[][]> allGameBoards = new ArrayList<>();

        allGameBoards.add(new int [][]{
                {6,1,0,0,2},
                {6,3,3,3,3},
                {6,1,1,1,1}
        });

        allGameBoards.add(new int [][]{
                {1,6,3,3,3},
                {0,6,0,0,2},
                {4,6,1,1,1}
        });

        allGameBoards.add(new int [][]{
                {1,3,6,3,3},
                {4,1,6,1,1},
                {0,1,6,0,2},
        });
        allGameBoards.add(new int [][]{
                {1,3,6,6,3},
                {4,1,6,6,1},
                {0,1,6,6,2},
        });
        allGameBoards.add(new int [][]{
                {1,3,6,3,6},
                {4,1,6,1,6},
                {0,1,6,0,6},
        });

        for (int[][] gameBoard : allGameBoards) {
            Bonus bonus = mummyGameConfig.getBonus(gameBoard);

            assertNotNull(bonus, "Bonus nie został przyznany dla poprawnej konfiguracji!");
            assertEquals("FREE_SPINS", bonus.getType(), "Nieprawidłowy typ bonusu!");
        }

    }
}
