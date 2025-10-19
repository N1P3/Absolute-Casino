package com.absoluteCasino.control.games.slot;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public abstract class Bonus {
    private String type;
    private String message;
    
    public Bonus(String type, String message) {
        this.type = type;
        this.message = message;
    }
}
