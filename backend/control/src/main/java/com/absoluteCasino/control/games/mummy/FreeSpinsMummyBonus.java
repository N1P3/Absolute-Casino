package com.absoluteCasino.control.games.mummy;

import com.absoluteCasino.control.games.slot.FreeSpinsBonus;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FreeSpinsMummyBonus extends FreeSpinsBonus {
    public Integer[][] mummyLine;
    
    public FreeSpinsMummyBonus(Integer[][] mummyLine) {
        super(20, "Napis MUMMY w linii przyznaje 20 FREE SPINS");
        this.setMummyLine(mummyLine);
        this.setType("FREE_SPINS_MUMMY");
    }
}
