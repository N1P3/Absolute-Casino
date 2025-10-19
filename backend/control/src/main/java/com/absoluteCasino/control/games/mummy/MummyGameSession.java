package com.absoluteCasino.control.games.mummy;

import com.absoluteCasino.control.games.GameSession;
import com.absoluteCasino.control.games.slot.Bonus;
import com.absoluteCasino.control.games.slot.FreeSpinsBonus;
import com.absoluteCasino.control.games.slot.SlotGameLogic;
import com.absoluteCasino.control.games.slot.SlotGameResultDTO;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MummyGameSession extends GameSession {


    private Bonus currentBonus = null;

    private final SlotGameLogic slotGame;

    private Long betMemory = 0L;

    public MummyGameSession(Integer userId) {
        super(GameSession.MUMMY, userId);
        this.slotGame = new SlotGameLogic(new MummyGameConfig());
    }

    public SlotGameResultDTO spin(Long bet) {

        if (hasFreeSpins()){
            ((FreeSpinsBonus) currentBonus).freeSpinsLeft--;
            bet = betMemory;
        } else {
            betMemory = bet;
        }

        SlotGameResultDTO slotGameResultDTO = slotGame.runBet(null);
 
        updateBonus(slotGameResultDTO.getBonus());
        
        slotGameResultDTO.setBonus(currentBonus);
   
        slotGameResultDTO.setMoneyWon((long) (bet * slotGameResultDTO.getMultiplier()));

        return slotGameResultDTO;
    }

    public boolean hasFreeSpins(){
        return currentBonus != null && currentBonus instanceof FreeSpinsBonus && ((FreeSpinsBonus) currentBonus).freeSpinsLeft > 0;
    }
    
    private void updateBonus(Bonus bonus){
        if(bonus == null){
            if(currentBonus != null && currentBonus instanceof FreeSpinsBonus && ((FreeSpinsBonus) currentBonus).freeSpinsLeft == 0){
                currentBonus = null;
            }
            return;
        }
        switch(bonus.getType()){
            case "FREE_SPINS_MUMMY":
            case "FREE_SPINS":
                if(currentBonus == null){
                    currentBonus = bonus;
                } else {
                    var currentSpins = ((FreeSpinsBonus) currentBonus).freeSpinsLeft;
                    currentBonus = bonus;
                    ((FreeSpinsBonus) currentBonus).freeSpinsLeft += currentSpins;
                }
                break;
            default:
                break;
        }
        
    }

}
