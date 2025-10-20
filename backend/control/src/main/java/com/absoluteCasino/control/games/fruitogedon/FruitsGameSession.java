package com.absoluteCasino.control.games.fruitogedon;

import com.absoluteCasino.control.games.GameSession;

import com.absoluteCasino.control.games.slot.*;
import lombok.Getter;

import java.util.Arrays;
import java.util.Set;

@Getter
public class FruitsGameSession extends GameSession {

    private final SlotGameLogic slotGame;
    private FruitsGameConfig fruitsGameConfig;
    private Bonus currentBonus;
    private Long betMemory = 0L;

    public FruitsGameSession(String sessionId, Integer userId) {
        super(sessionId, userId);
        fruitsGameConfig = new FruitsGameConfig();
        this.slotGame = new SlotGameLogic(fruitsGameConfig);
    }

    public SlotGameResultDTO spin(Long bet){
        if (hasFreeSpins()){
            ((FreeSpinsBonus) currentBonus).freeSpinsLeft--;
            bet = betMemory;
        } else {
            betMemory = bet;
        }
        SlotGameResultDTO slotGameResultDTO = slotGame.runBet(currentBonus);
        updateBonus(slotGameResultDTO.getBonus(), slotGameResultDTO.getJackpot());

        slotGameResultDTO.setBonus(currentBonus);
        slotGameResultDTO.setMoneyWon((long) (bet * slotGameResultDTO.getMultiplier()));
        return slotGameResultDTO;
    }
    
    public boolean hasFreeSpins(){
        return currentBonus != null && currentBonus instanceof FreeSpinsBonus && ((FreeSpinsBonus) currentBonus).freeSpinsLeft > 0;
    }

    private void updateBonus(Bonus bonus, Jackpot jackpot){
        if(bonus == null){
            if(currentBonus != null && currentBonus instanceof FreeSpinsBonus && ((FreeSpinsBonus) currentBonus).freeSpinsLeft == 0){
                currentBonus = null;
            }
            return;
        }
        if(jackpot != null){
            currentBonus = null;
            return;
        }
        switch(bonus.getType()){
            case "WILD_FREEZE":
                if(currentBonus == null){
                    currentBonus = bonus;
                } else {
                    if (((WildFreezeBonus) currentBonus).frozenColumns.size() != ((WildFreezeBonus) bonus).frozenColumns.size()) {
                        ((WildFreezeBonus) currentBonus).freeSpinsLeft = 3;

                        var currentFrozen = ((WildFreezeBonus)currentBonus).frozenColumns;
                        var newFrozen = ((WildFreezeBonus)bonus).frozenColumns;
                        currentFrozen.addAll(newFrozen);
                        ((WildFreezeBonus) currentBonus).frozenColumns = currentFrozen;
                    }

                    if (freezeBonusEnded(bonus)) {
                        currentBonus = null;
                    }
                }
                break;
            default:
                break;
        }

    }

    private boolean freezeBonusEnded(Bonus bonus) {
        WildFreezeBonus wildFreezeBonus = (WildFreezeBonus) bonus;
        WildFreezeBonus currentWildFreezeBonus = (WildFreezeBonus) currentBonus;

        return wildFreezeBonus.frozenColumns.size() == currentWildFreezeBonus.frozenColumns.size() && currentWildFreezeBonus.freeSpinsLeft == 0;
    }
}