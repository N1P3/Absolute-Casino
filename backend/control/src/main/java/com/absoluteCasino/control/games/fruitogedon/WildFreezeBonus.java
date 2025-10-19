package com.absoluteCasino.control.games.fruitogedon;

import com.absoluteCasino.control.games.slot.Bonus;
import com.absoluteCasino.control.games.slot.FreeSpinsBonus;

import java.util.Set;

public class WildFreezeBonus extends FreeSpinsBonus {
    public Set<Integer> frozenColumns;
    
    public WildFreezeBonus(Set<Integer> frozenColumns) {
        super(3, "3x WILD w kolumnie przyznaje zamrożenie kolumny oraz 3 FREE SPINS");
        this.frozenColumns = frozenColumns;
        this.setType("WILD_FREEZE");
    }
    
    
}
