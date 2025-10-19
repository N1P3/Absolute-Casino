package com.absoluteCasino.control.games.slot;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public class SlotGameLogic {
    SlotGameConfig slotGameConfig;

    public SlotGameLogic(SlotGameConfig slotGameConfig) {
        this.slotGameConfig = slotGameConfig;
    }

    public SlotGameResultDTO runBet(Bonus currentBonus) {
        return getDtoResult(slotGameConfig.generateGameBoard(currentBonus));
    }

    private SlotGameResultDTO getDtoResult(int[][] gameBoard) {
        List<Map.Entry<String, Integer[][]>> winningLines = slotGameConfig.getWinningLines(gameBoard);
        double multiplier = calculateMultiplierForLines(winningLines, gameBoard);
        var bonus = slotGameConfig.getBonus(gameBoard);
        var jackpot = slotGameConfig.getJackpot(gameBoard, winningLines);

        return new SlotGameResultDTO(winningLines, gameBoard, multiplier, bonus, jackpot);
    }

    private double calculateMultiplierForLines(List<Map.Entry<String, Integer[][]>> winningLines, int[][] gameBoard) {
        double linesMultiplier = 0;

        for (Map.Entry<String, Integer[][]> entry : winningLines) {
            linesMultiplier += slotGameConfig.calculateMultiplierForLine(entry.getValue(), gameBoard);
        }

        return linesMultiplier;
    }

}
