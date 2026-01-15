package com.absoluteCasino.control.games.poker;

import com.absoluteCasino.control.utils.Seat;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

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
    private List<String> holeCards;
    private boolean winner;

    public static HoldemPlayerResponse from(Seat seat,
                                            Long viewerUserId,
                                            HoldemHand hand,
                                            Integer currentPlayerSeat,
                                            List<Integer> winners) {
        if (seat == null || !seat.isOccupied()) {
            return null;
        }

        HoldemPlayerResponse dto = new HoldemPlayerResponse();
        int pos = seat.getPosition();

        dto.userId = seat.getUserId();
        dto.seatPosition = pos;
        dto.stack = seat.getStack();
        dto.winner = winners != null && winners.contains(pos);

        if (hand != null) {
            PlayerHandState ps = hand.getPlayers().get(pos);
            if (ps != null) {
                dto.betThisStreet = ps.getTotalChipsInPot();
                dto.folded = ps.isFolded();
                dto.allIn = ps.isAllIn();

                // Show cards if it's the viewer OR if it's showdown
                boolean isShowdown = hand.getStreet() == BettingStreet.SHOWDOWN;
                boolean isViewer = viewerUserId != null && viewerUserId.equals(seat.getUserId());
                
                if (isViewer || (isShowdown && !ps.isFolded())) {
                    dto.holeCards = hand.getHoleCardsForSeat(pos);
                }
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
