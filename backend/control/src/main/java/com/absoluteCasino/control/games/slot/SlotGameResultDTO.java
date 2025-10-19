package com.absoluteCasino.control.games.slot;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
public class SlotGameResultDTO {
    private final List<Map.Entry<String, Integer[][]>> winningLines;
    private final int[][] gameBoard;
    private final double multiplier;
    private long moneyWon;
    private Bonus bonus;
    private Jackpot jackpot;

    public SlotGameResultDTO(List<Map.Entry<String, Integer[][]>> winningLines, int[][] gameBoard, double multiplier, Bonus bonus, Jackpot jackpot) {
        this.winningLines = winningLines;
        this.gameBoard = gameBoard;
        this.multiplier = multiplier;
        this.bonus = bonus;
        this.jackpot = jackpot;
    }
}
