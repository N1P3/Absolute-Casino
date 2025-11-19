package com.absoluteCasino.control.games.poker;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PlayerHandState {

    private final int seatPosition;

    private String hole1;
    private String hole2;

    private boolean folded = false;
    private boolean allIn = false;

    private long chipsInPotThisStreet = 0L;
    private long totalChipsInPot = 0L;

    public PlayerHandState(int seatPosition) {
        this.seatPosition = seatPosition;
    }
}
