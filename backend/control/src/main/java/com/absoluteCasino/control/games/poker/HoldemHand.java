package com.absoluteCasino.control.games.poker;

import com.absoluteCasino.control.utils.CardsShoe;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class HoldemHand {

    private final int tableId;

    private final CardsShoe shoe;

    private BettingStreet street = BettingStreet.PREFLOP;
    private final List<String> communityCards = new ArrayList<>();

    private int currentPlayerSeat;
    private long currentBet;
    private long pot;

    private final Map<Integer, PlayerHandState> players = new HashMap<>();

    public HoldemHand(int tableId, CardsShoe shoe) {
        this.tableId = tableId;
        this.shoe = shoe;
    }

    public long getBetThisStreetForSeat(int seatPosition) {
        PlayerHandState state = players.get(seatPosition);
        if (state == null) {
            return 0L;
        }
        return state.getChipsInPotThisStreet();
    }

    public boolean isSeatFolded(int seatPosition) {
        PlayerHandState state = players.get(seatPosition);
        if (state == null) {
            return false;
        }
        return state.isFolded();
    }

    public List<String> getHoleCardsForSeat(int seatPosition) {
        PlayerHandState state = players.get(seatPosition);
        if (state == null) {
            return List.of();
        }
        List<String> cards = new ArrayList<>(2);
        if (state.getHole1() != null) {
            cards.add(state.getHole1());
        }
        if (state.getHole2() != null) {
            cards.add(state.getHole2());
        }
        return cards;
    }
}
