package com.absoluteCasino.control.games.slot;

import lombok.Getter;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Getter
public class MatrixGenerator {
    protected final int rows;
    protected final int cols;
    protected final int[] chances;

    public MatrixGenerator(int rows, int cols, int[] chances) {
        this.rows = rows;
        this.cols = cols;
        this.chances = chances;
        validateChances();
    }

    protected void validateChances() {
        if (chances == null || chances.length == 0) {
            throw new IllegalArgumentException("Chances array cannot be null or empty.");
        }
        int sum = 0;
        for (int chance : chances) {
            if (chance < 0) {
                throw new IllegalArgumentException("Chances must be non-negative.");
            }
            sum += chance;
        }
        if (sum != 100) {
            throw new IllegalArgumentException("Chances must sum up to 100.");
        }
    }

    public int[][] generateMatrix() {
        int[][] data = new int[rows][cols];
        List<Integer> cumulativeChances = calculateCumulativeChances();
        Random random = new Random();

        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                data[i][j] = generateNumber(cumulativeChances, random);
            }
        }
        return data;
    }

    protected List<Integer> calculateCumulativeChances() {
        List<Integer> cumulativeChances = new ArrayList<>();
        int sum = 0;
        for (int chance : chances) {
            sum += chance;
            cumulativeChances.add(sum);
        }
        return cumulativeChances;
    }

    protected int generateNumber(List<Integer> cumulativeChances, Random random) {
        int rand = random.nextInt(100) + 1;

        for (int i = 0; i < cumulativeChances.size(); i++) {
            if (rand <= cumulativeChances.get(i)) {
                return i;
            }
        }
        return chances.length;
    }
}
