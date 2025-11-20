package com.absoluteCasino.control.games.poker;

import com.absoluteCasino.control.utils.Seat;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class HoldemPlayerResponse {

    private Long userId;
    private Integer seatPosition;
    private Long stack;
    private Long betThisStreet;
    private boolean folded;
    private boolean allIn;
    private boolean currentTurn;
    private boolean you;

    public static HoldemPlayerResponse from(Seat seat,
                                            Long viewerUserId,
                                            HoldemHand hand,
                                            Integer currentPlayerSeat) {
        if (seat == null || !seat.isOccupied()) {
            return null;
        }

        HoldemPlayerResponse dto = new HoldemPlayerResponse();
        int pos = seat.getPosition();

        dto.userId = seat.getUserId();
        dto.seatPosition = pos;
        dto.stack = seat.getStack();

        if (hand != null) {
            PlayerHandState ps = hand.getPlayers().get(pos);
            if (ps != null) {
                dto.betThisStreet = ps.getChipsInPotThisStreet();
                dto.folded = ps.isFolded();
                dto.allIn = ps.isAllIn();
            } else {
                dto.betThisStreet = 0L;
                dto.folded = false;
                dto.allIn = false;
            }
            dto.currentTurn = currentPlayerSeat != null && currentPlayerSeat == pos;
        } else {
            dto.betThisStreet = 0L;
            dto.folded = false;
            dto.allIn = false;
            dto.currentTurn = false;
        }

        dto.you = viewerUserId != null && viewerUserId.equals(seat.getUserId());
        return dto;
    }
}
