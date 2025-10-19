package com.absoluteCasino.control.games.mummy;

import com.absoluteCasino.control.games.slot.Bonus;
import com.absoluteCasino.control.games.slot.FreeSpinsBonus;
import com.absoluteCasino.control.games.slot.Jackpot;
import com.absoluteCasino.control.games.slot.SlotGameConfig;
import org.apache.el.parser.BooleanNode;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MummyGameConfig extends SlotGameConfig {
    private static final HashMap<Integer, String> SYMBOLS = new HashMap<>();
    private static final HashMap<String, Integer[][]> WINNING_LINES = new HashMap<>();
    private static final int ROWS = 3;
    private static final int COLS = 5;
    private static final int[] CHANCES = new int[]{25, 20, 20, 10, 10, 10, 5};

    static {
        SYMBOLS.put(0, "M");
        SYMBOLS.put(1, "U");
        SYMBOLS.put(2, "Y");
        SYMBOLS.put(3, "MUMMY1");
        SYMBOLS.put(4, "MUMMY2");
        SYMBOLS.put(5, "MUMMY3");
        SYMBOLS.put(6, "GOLDEN_MUMMY");

        WINNING_LINES.put("LINE_1", new Integer[][]{{0, 0}, {0, 1}, {0, 2}, {0, 3}, {0, 4}});
        WINNING_LINES.put("LINE_2", new Integer[][]{{1, 0}, {1, 1}, {1, 2}, {1, 3}, {1, 4}});
        WINNING_LINES.put("LINE_3", new Integer[][]{{2, 0}, {2, 1}, {2, 2}, {2, 3}, {2, 4}});
        WINNING_LINES.put("LINE_4", new Integer[][]{{0, 0}, {1, 1}, {2, 2}, {1, 3}, {0, 4}});
        WINNING_LINES.put("LINE_5", new Integer[][]{{2, 0}, {1, 1}, {0, 2}, {1, 3}, {2, 4}});
        WINNING_LINES.put("LINE_6", new Integer[][]{{0, 0}, {1, 1}, {1, 2}, {1, 3}, {1, 4}});
        WINNING_LINES.put("LINE_7", new Integer[][]{{1, 0}, {0, 1}, {0, 2}, {0, 3}, {0, 4}});
        WINNING_LINES.put("LINE_8", new Integer[][]{{1, 0}, {2, 1}, {2, 2}, {2, 3}, {2, 4}});
        WINNING_LINES.put("LINE_9", new Integer[][]{{2, 0}, {1, 1}, {1, 2}, {1, 3}, {1, 4}});
        WINNING_LINES.put("LINE_10", new Integer[][]{{0, 0}, {1, 1}, {1, 2}, {1, 3}, {2, 4}});
        WINNING_LINES.put("LINE_11", new Integer[][]{{2, 0}, {1, 1}, {1, 2}, {1, 3}, {0, 4}});
        WINNING_LINES.put("LINE_12", new Integer[][]{{0, 0}, {0, 1}, {0, 2}, {1, 3}, {2, 4}});
        WINNING_LINES.put("LINE_13", new Integer[][]{{1, 0}, {1, 1}, {1, 2}, {0, 3}, {0, 4}});
        WINNING_LINES.put("LINE_14", new Integer[][]{{1, 0}, {1, 1}, {1, 2}, {2, 3}, {2, 4}});
        WINNING_LINES.put("LINE_15", new Integer[][]{{2, 0}, {2, 1}, {2, 2}, {1, 3}, {0, 4}});
        WINNING_LINES.put("LINE_16", new Integer[][]{{0, 0}, {1, 1}, {2, 2}, {2, 3}, {2, 4}});
        WINNING_LINES.put("LINE_17", new Integer[][]{{2, 0}, {1, 1}, {0, 2}, {0, 3}, {0, 4}});
        WINNING_LINES.put("LINE_18", new Integer[][]{{1, 0}, {0, 1}, {1, 2}, {2, 3}, {1, 4}});
        WINNING_LINES.put("LINE_19", new Integer[][]{{1, 0}, {2, 1}, {1, 2}, {0, 3}, {1, 4}});
        WINNING_LINES.put("LINE_20", new Integer[][]{{0, 0}, {1, 1}, {0, 2}, {1, 3}, {0, 4}});
    }

    public MummyGameConfig() {
        super(WINNING_LINES, SYMBOLS, ROWS, COLS, CHANCES);
    }

    @Override
    public Bonus getBonus(int[][] gameBoard) {

        for (Integer[][] winningLine : WINNING_LINES.values()) {
            if (checkLineHasMummy(winningLine, gameBoard))
                return new FreeSpinsMummyBonus(winningLine);
        }

        int goldenMummies = 0;

        for (int i = 0; i < gameBoard.length; i++) {
            for (int j = 0; j < gameBoard[i].length; j++) {
                if (gameBoard[i][j] == 6)
                    goldenMummies++;
            }
        }
        if (goldenMummies >= 3)
            return new FreeSpinsBonus(5, "3 złote mumie przyznają 5 FREE SPINS!");
        return null;
    }

    @Override
    public Jackpot getJackpot(int[][] gameBoard, List<Map.Entry<String, Integer[][]>> winningLines) {
        return null;
    }

    private boolean checkLineHasMummy(Integer[][] line, int[][] gameBoard) {
        
        return gameBoard[line[0][0]][line[0][1]] == 0 && // M
                gameBoard[line[1][0]][line[1][1]] == 1 && // U
                gameBoard[line[2][0]][line[2][1]] == 0 && // M
                gameBoard[line[3][0]][line[3][1]] == 0 && // M
                gameBoard[line[4][0]][line[4][1]] == 2;// Y
    }

    @Override
    public double calculateMultiplierForSymbol(String symbol, int count) {
        return switch (symbol) {
            case "M" -> switch (count) {
                case 3 -> 1.0;
                case 4 -> 1.12;
                case 5 -> 1.25;
                default -> 0;
            };
            case "U" -> switch (count) {
                case 3 -> 1.0;
                case 4 -> 1.25;
                case 5 -> 1.5;
                default -> 0;
            };
            case "Y" -> switch (count) {
                case 3 -> 1.0;
                case 4 -> 1.25;
                case 5 -> 1.5;
                default -> 0;
            };
            case "MUMMY1" -> switch (count) {
                case 3 -> 1.25;
                case 4 -> 1.4;
                case 5 -> 1.6;
                default -> 0;
            };
            case "MUMMY2" -> switch (count) {
                case 3 -> 1.25;
                case 4 -> 1.4;
                case 5 -> 1.6;
                default -> 0;
            };
            case "MUMMY3" -> switch (count) {
                case 3 -> 1.25;
                case 4 -> 1.4;
                case 5 -> 1.6;
                default -> 0;
            };
            case "GOLDEN_MUMMY" -> 0.0;
            default -> throw new IllegalStateException("Unexpected value: " + symbol);
        };
    }
    

}
