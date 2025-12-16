package com.absoluteCasino.control.utils;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Seat {

    private final int position;
    private Long userId; // null = puste miejsce
    private long stack; // żetony na stole
    private boolean sittingOut;
    private boolean isAi;

    public Seat(int position) {
        this.position = position;
    }

    public boolean isOccupied() {
        return userId != null;
    }
}
