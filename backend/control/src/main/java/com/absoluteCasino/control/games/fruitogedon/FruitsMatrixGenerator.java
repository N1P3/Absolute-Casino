package com.absoluteCasino.control.games.fruitogedon;

import com.absoluteCasino.control.games.slot.MatrixGenerator;

import java.util.List;
import java.util.Random;

public class FruitsMatrixGenerator extends MatrixGenerator {
    public final static int bonusValue = 6;

    public FruitsMatrixGenerator(int rows, int cols, int[] chances) {
        super(rows, cols, chances);
    }

    @Override
    public int[][] generateMatrix() {
        int[][] data = new int[this.rows][this.cols];
        List<Integer> cumulativeChances = calculateCumulativeChances();
        Random random = new Random();

        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                data[i][j] = generateNumber(cumulativeChances, random);
            }
        }

        correctBonus(data, random);

        return data;
    }

    public void correctBonus(int[][] matrix, Random random) {
        int innerBonusChances = 10;

        for (int i = 0; i < this.cols; i++){
            int wildCount = 0;
            for (int j = 0; j < this.rows; j++) {
                if (matrix[j][i] == bonusValue) {
                    wildCount++;
                }
            }
            if(wildCount == 0 || wildCount == this.rows) {
                continue;
            }

            if (random.nextInt(0,100) < innerBonusChances * wildCount) {
                for (int j = 0; j < this.rows; j++) {
                    matrix[j][i] = bonusValue;
                }
            }
        }
    }
}
