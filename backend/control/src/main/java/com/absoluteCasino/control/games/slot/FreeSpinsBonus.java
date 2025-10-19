package com.absoluteCasino.control.games.slot;

import lombok.Getter;

@Getter
public class FreeSpinsBonus extends Bonus{
    
    public int freeSpinsLeft;
    
    public FreeSpinsBonus(int freeSpinsLeft, String message) {
        super("FREE_SPINS", message);
        this.freeSpinsLeft = freeSpinsLeft;
    }
    
}
