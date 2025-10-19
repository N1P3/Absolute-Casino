import com.absoluteCasino.control.games.mummy.MummyGameConfig;
import com.absoluteCasino.control.games.slot.Bonus;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

public class MummyBonusTest {

    private List<int[]> generateCombinations(int n, int k) {
        List<int[]> combinations = new ArrayList<>();
        generateCombinationsRecursive(new int[k], 0, 0, n, combinations);
        return combinations;
    }

    private void generateCombinationsRecursive(int[] current, int index, int start, int n, List<int[]> result) {
        if (index == current.length) {
            result.add(current.clone());
            return;
        }

        for (int i = start; i < n; i++) {
            current[index] = i;
            generateCombinationsRecursive(current, index + 1, i + 1, n, result);
        }
    }

    private List<int[][]> generateAllPossibleBoards() {
        int rows = 3;
        int cols = 5;
        int totalCells = rows * cols;

        List<int[][]> allBoards = new ArrayList<>();

        List<int[]> sixPositions = generateCombinations(totalCells, 3);

        for (int[] positions : sixPositions) {
            int[][] board = new int[rows][cols];

            for (int i = 0; i < rows; i++) {
                for (int j = 0; j < cols; j++) {
                    board[i][j] = 1;
                }
            }

            for (int pos : positions) {
                int row = pos / cols;
                int col = pos % cols;
                board[row][col] = 6;
            }

            allBoards.add(board);
        }

        return allBoards;
    }

    @Test
    void mummyBonusWorkProperlyOnAllCases() {
        MummyGameConfig mummyGameConfig = new MummyGameConfig();

        List<int[][]> allGameBoards = generateAllPossibleBoards();

        for (int[][] gameBoard : allGameBoards) {
            int sixCount = 0;
            for (int[] row : gameBoard) {
                for (int num : row) {
                    if (num == 6) {
                        sixCount++;
                    }
                }
            }

            assertEquals(3, sixCount, "Tablica nie zawiera dokładnie 3 wartości 6!");

            Bonus bonus = mummyGameConfig.getBonus(gameBoard);

            assertNotNull(bonus, "Bonus nie został przyznany dla poprawnej konfiguracji!");
            assertEquals("FREE_SPINS", bonus.getType(), "Nieprawidłowy typ bonusu!");
        }

    }

    @Test
    void mummySuperBonusWorkProperlyOnAllCases() {
        MummyGameConfig mummyGameConfig = new MummyGameConfig();

        List<int[][]> allGameBoards = new ArrayList<>();

        allGameBoards.add(new int [][]{
                {0,1,0,0,2},
                {1,3,3,3,3},
                {4,1,1,1,1}
        });

        allGameBoards.add(new int [][]{
                {1,3,3,3,3},
                {0,1,0,0,2},
                {4,1,1,1,1}
        });

        allGameBoards.add(new int [][]{
                {1,3,3,3,3},
                {4,1,1,1,1},
                {0,1,0,0,2},
        });

        for (int[][] gameBoard : allGameBoards) {
            Bonus bonus = mummyGameConfig.getBonus(gameBoard);

            assertNotNull(bonus, "Bonus nie został przyznany dla poprawnej konfiguracji!");
            assertEquals("FREE_SPINS_MUMMY", bonus.getType(), "Nieprawidłowy typ bonusu!");
        }

    }
}
