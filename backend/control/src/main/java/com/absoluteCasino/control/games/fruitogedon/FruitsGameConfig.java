package com.absoluteCasino.control.games.fruitogedon;

import com.absoluteCasino.control.games.slot.Bonus;
import com.absoluteCasino.control.games.slot.Jackpot;
import com.absoluteCasino.control.games.slot.MatrixGenerator;
import com.absoluteCasino.control.games.slot.SlotGameConfig;

import java.io.Console;
import java.util.*;

public class FruitsGameConfig extends SlotGameConfig {
    private static final HashMap<Integer, String> SYMBOLS = new HashMap<>();
    private static final HashMap<String, Integer[][]> WINNING_LINES = new HashMap<>();
    private static final int ROWS = 3;
    private static final int COLS = 5;
    private static final int[] CHANCES = new int[] {25, 23, 17, 12, 10, 10, 3};
    
    

    static {
        SYMBOLS.put(0,"CHERRY");
        SYMBOLS.put(1,"LEMON");
        SYMBOLS.put(2,"ORANGE");
        SYMBOLS.put(3,"STRAWBERRY");
        SYMBOLS.put(4,"GRAPES");
        SYMBOLS.put(5,"WATERLEMON");
        SYMBOLS.put(6,"WILD");

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

    public FruitsGameConfig() {
        super(WINNING_LINES, SYMBOLS, ROWS, COLS, CHANCES, new FruitsMatrixGenerator(ROWS, COLS, CHANCES));
    }

    @Override
    public Bonus getBonus(int[][] gameBoard) {
        Set<Integer> frozenColumns = new HashSet<>();
        for (int col = 0; col < COLS; col++) {
            int wildSymbols = 0;
            for (int row = 0; row < ROWS; row++) {
                if (Objects.equals(SYMBOLS.get(gameBoard[row][col]), "WILD"))
                    wildSymbols++;
            }
            if(wildSymbols == 3)
                frozenColumns.add(col);
        }
        if(!frozenColumns.isEmpty())
            return new WildFreezeBonus(frozenColumns);

        return null;
    }

    @Override
    public Jackpot getJackpot(int[][] gameBoard, List<Map.Entry<String, Integer[][]>> winningLines){
        int count =0;
        for(Map.Entry<String, Integer[][]> entry : winningLines){
            String line = entry.getKey();

            if(checkLineForJackpot(entry.getValue(), gameBoard))
                count++;
        }
        if(count >= 3) {
            return Jackpot.GRAND;
        }
        if(count == 2) {
            return Jackpot.MAJOR;
        }
        if(count == 1) {
            return Jackpot.MINOR;
        }
        return null;
        
    }

    @Override
    public int[][] generateGameBoard(Bonus currentBonus) {
        var matrix = this.matrixGenerator.generateMatrix();
        if(currentBonus instanceof WildFreezeBonus) {
            for (int col : ((WildFreezeBonus) currentBonus).frozenColumns) {
                for (int row = 0; row < ROWS; row++) {
                    matrix[row][col] = 6;
                }
            }
        }
        return matrix;
    }



    @Override
    public double calculateMultiplierForSymbol(String symbol, int count) {
        return switch (symbol) {
            case "CHERRY" -> switch (count) { case 3 -> 0.175; case 4 -> 0.35; case 5 -> 0.7; default -> 0; };
            case "LEMON" -> switch (count) { case 3 -> 0.2625; case 4 -> 0.525; case 5 -> 1.05; default -> 0; };
            case "ORANGE" -> switch (count) { case 3 -> 0.35; case 4 -> 0.7; case 5 -> 1.4; default -> 0; };
            case "STRAWBERRY" -> switch (count) { case 3 -> 0.525; case 4 -> 1.05; case 5 -> 1.75; default -> 0; };
            case "GRAPES" -> switch (count) { case 3 -> 0.7; case 4 -> 1.75; case 5 -> 3.5; default -> 0; };
            case "WATERLEMON" -> switch (count) { case 3 -> 1.05; case 4 -> 3.5; case 5 -> 8.75; default -> 0; };
            case "WILD" -> switch (count) { case 3 -> 0.35; case 4 -> 0.35; case 5 -> 70.0; default -> 0; };
            default -> throw new IllegalStateException("Unexpected value: " + symbol);
        };
    }


    @Override
    public boolean checkSingleLine(Integer[][] lineCoordinates, int[][] gameBoard) {
        HashSet<String> lineSymbols = new HashSet<>();

        for (int i = 0; i < 3; i++) {
            Integer[] coordinate = lineCoordinates[i];
            int currentValue = gameBoard[coordinate[0]][coordinate[1]];
            String currentSymbol = symbols.get(currentValue);
            lineSymbols.add(currentSymbol);
        }
        if(lineSymbols.size() == 1)
            return true;
        
        lineSymbols.remove("WILD");

        return lineSymbols.size() == 1;
    }
    
    private String determineLineSymbol(Integer[][] line, int[][] gameBoard){
        for (Integer[] coordinate : line) {
            String currentSymbol = getSymbol(gameBoard[coordinate[0]][coordinate[1]]);
            if(!Objects.equals(currentSymbol, "WILD"))
                return currentSymbol;
        }
        return "WILD";
    }

    @Override
    public double calculateMultiplierForLine(Integer[][] line, int[][] gameBoard) {
        int symbolCount = 0;
        String symbol = determineLineSymbol(line, gameBoard);
        for (Integer[] coordinate : line) {
            String currentSymbol = getSymbol(gameBoard[coordinate[0]][coordinate[1]]);

            if (!Objects.equals(currentSymbol, symbol) && (!currentSymbol.equals("WILD") || symbol.equals("WILD"))) {
                return calculateMultiplierForSymbol(symbol, symbolCount);
            } else {
                symbolCount++;
            }
        }

        return calculateMultiplierForSymbol(symbol, symbolCount);
    }
    
    private boolean checkLineForJackpot(Integer[][] line, int[][] gameBoard){
        for (Integer[] coordinate : line) {
            if(!Objects.equals(getSymbol(gameBoard[coordinate[0]][coordinate[1]]), "WILD"))
                return false;
        }
        return true;
    }

}
