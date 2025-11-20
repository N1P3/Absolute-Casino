package com.absoluteCasino.control.games.poker;

import com.absoluteCasino.control.utils.Seat;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class HoldemTableStateResponse {

    private String type;
    private Long tableId;
    private Long smallBlind;
    private Long bigBlind;
    private Long pot;
    private Long currentBet;
    private String street;
    private Integer currentPlayerSeat;
    private Integer dealerSeat;
    private List<String> communityCards;
    private List<String> viewerHoleCards;
    private List<HoldemPlayerResponse> players;
    private List<String> availableActions;
    private String result;
    private String lastAction;

    public static HoldemTableStateResponse from(HoldemTable table, Long viewerUserId) {
        HoldemTableStateResponse dto = new HoldemTableStateResponse();

        dto.type = "GAME_STATE";
        dto.tableId = table.getId();
        dto.smallBlind = table.getBlinds().smallBlind();
        dto.bigBlind = table.getBlinds().bigBlind();

        HoldemHand hand = table.getCurrentHand();

        dto.pot = hand != null ? hand.getPot() : 0L;
        dto.currentBet = hand != null ? hand.getCurrentBet() : 0L;
        dto.street = hand != null && hand.getStreet() != null
                ? hand.getStreet().name()
                : null;
        dto.currentPlayerSeat = hand != null
                ? hand.getCurrentPlayerSeat()
                : null;
        dto.dealerSeat = table.getDealerPosition();

        dto.communityCards = new ArrayList<>();
        if (hand != null) {
            dto.communityCards.addAll(hand.getCommunityCards());
        }

        dto.viewerHoleCards = new ArrayList<>();
        Seat viewerSeat = table.getSeats().stream()
                .filter(Seat::isOccupied)
                .filter(s -> viewerUserId != null && viewerUserId.equals(s.getUserId()))
                .findFirst()
                .orElse(null);
        if (viewerSeat != null && hand != null) {
            dto.viewerHoleCards.addAll(
                    hand.getHoleCardsForSeat(viewerSeat.getPosition())
            );
        }

        dto.players = new ArrayList<>();
        for (Seat seat : table.getSeats()) {
            HoldemPlayerResponse p =
                    HoldemPlayerResponse.from(seat, viewerUserId, hand, dto.currentPlayerSeat);
            if (p != null) {
                dto.players.add(p);
            }
        }

        dto.availableActions = table.getAvailableActionsForSeat(dto.currentPlayerSeat);
        dto.result = table.getLastResultText();
        dto.lastAction = table.getLastActionText();

        return dto;
    }
}
