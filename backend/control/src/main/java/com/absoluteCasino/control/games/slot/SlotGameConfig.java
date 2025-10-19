package com.absoluteCasino.control.games.slot;

import java.util.*;

public abstract class SlotGameConfig {
    public HashMap<String, Integer[][]>  winningLines= new HashMap<>();
    public HashMap<Integer, String> symbols = new HashMap<>();
    protected MatrixGenerator matrixGenerator;
    int rows, cols;
    int[] chances;

    public SlotGameConfig(HashMap<String, Integer[][]> winningLines, HashMap<Integer, String> symbols, int rows, int cols, int[] chances, MatrixGenerator matrixGenerator) {
        this.winningLines = winningLines;
        this.symbols = symbols;
        this.rows = rows;
        this.cols = cols;
        this.chances = chances;

        this.matrixGenerator = matrixGenerator;
    }

    public SlotGameConfig(HashMap<String, Integer[][]> winningLines, HashMap<Integer, String> symbols, int rows, int cols, int[] chances) {
        this.winningLines = winningLines;
        this.symbols = symbols;
        this.rows = rows;
        this.cols = cols;
        this.chances = chances;

        matrixGenerator = new MatrixGenerator(rows, cols, chances);
    }

    public ArrayList<Map.Entry<String, Integer[][]>> getWinningLines(int[][] gameBoard) {
        ArrayList<Map.Entry<String, Integer[][]>> winningLinesList = new ArrayList<>();

        for (String lineName : winningLines.keySet()) {
            Integer[][] lineCoordinates = winningLines.get(lineName);

            if (checkSingleLine(lineCoordinates, gameBoard)) {
                winningLinesList.add(new AbstractMap.SimpleEntry<>(lineName, lineCoordinates));
            }
        }

        return winningLinesList;
    }

    public boolean checkSingleLine(Integer[][] lineCoordinates, int[][] gameBoard) {
        HashSet<String> lineSymbols = new HashSet<>();

        for (int i = 0; i < 3; i++) {
            Integer[] coordinate = lineCoordinates[i];
            int currentValue = gameBoard[coordinate[0]][coordinate[1]];
            String currentSymbol = symbols.get(currentValue);

            lineSymbols.add(currentSymbol);
        }

        return lineSymbols.size() == 1;
    }

    public double calculateMultiplierForLine(Integer[][] line, int[][] gameBoard) {
        int symbolCount = 0;
        String symbol = getSymbol(gameBoard[line[0][0]][line[0][1]]);

        for (Integer[] coordinate : line) {
            String currentSymbol = getSymbol(gameBoard[coordinate[0]][coordinate[1]]);

            if (!Objects.equals(currentSymbol, symbol)) {
                return calculateMultiplierForSymbol(symbol, symbolCount);
            } else {
                symbolCount++;
            }
        }

        return calculateMultiplierForSymbol(symbol, symbolCount);
    }

    public int[][] generateGameBoard(Bonus bonus) {
        return matrixGenerator.generateMatrix();
    }

    public String getSymbol(int symbolCode) {
        return symbols.get(symbolCode);
    }

    public abstract Bonus getBonus(int[][] gameBoard);
    public abstract Jackpot getJackpot(int[][] gameBoard, List<Map.Entry<String, Integer[][]>> winningLines);

    public abstract double calculateMultiplierForSymbol(String symbol, int count);
}
