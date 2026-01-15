package com.absoluteCasino.control.games.poker;

import com.absoluteCasino.control.utils.Seat;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class HoldemTable {

    private final int tableId;
    private final int maxSeats;
    private final Blinds blinds;
    private final long minBuyIn;
    private final long maxBuyIn;

    private final List<Seat> seats = new ArrayList<>();

    private TableStatus status = TableStatus.WAITING_FOR_PLAYERS;

    private int dealerPosition = -1;
    private HoldemHand currentHand;

    private String lastResultText;
    private long lastResultTimestamp;
    private String lastActionText;
    private List<Integer> lastWinners = new ArrayList<>();

    public HoldemTable(int tableId,
                       int maxSeats,
                       Blinds blinds,
                       long minBuyIn,
                       long maxBuyIn) {
        this.tableId = tableId;
        this.maxSeats = maxSeats;
        this.blinds = blinds;
        this.minBuyIn = minBuyIn;
        this.maxBuyIn = maxBuyIn;
        for (int i = 0; i < maxSeats; i++) {
            seats.add(new Seat(i));
        }
    }

    public Long getId() {
        return (long) tableId;
    }

    public long getCurrentBet() {
        return currentHand != null ? currentHand.getCurrentBet() : 0L;
    }

    public Integer getCurrentPlayerSeat() {
        return currentHand != null ? currentHand.getCurrentPlayerSeat() : null;
    }

    public long getActivePlayersCount() {
        return seats.stream().filter(Seat::isOccupied).count();
    }

    public Seat getSeat(int seatPosition) {
        if (seatPosition < 0 || seatPosition >= seats.size()) {
            return null;
        }
        return seats.get(seatPosition);
    }

    public List<String> getAvailableActionsForSeat(Integer seatPosition) {
        List<String> actions = new ArrayList<>();
        if (seatPosition == null) {
            return actions;
        }
        if (currentHand == null || currentHand.getStreet() == BettingStreet.SHOWDOWN) {
            return actions;
        }
        Seat seat = getSeat(seatPosition);
        if (seat == null || !seat.isOccupied()) {
            return actions;
        }
        if (!isSeatOnTurn(seatPosition)) {
            return actions;
        }
        if (canFold(seatPosition)) {
            actions.add("FOLD");
        }
        if (canCheck(seatPosition)) {
            actions.add("CHECK");
        }
        if (canCall(seatPosition)) {
            actions.add("CALL");
        }
        if (canBet(seatPosition)) {
            actions.add("BET");
        }
        if (canRaise(seatPosition)) {
            actions.add("RAISE");
        }
        if (canAllIn(seatPosition)) {
            actions.add("ALL_IN");
        }
        return actions;
    }

    private boolean isSeatOnTurn(Integer seatPosition) {
        Integer current = getCurrentPlayerSeat();
        return current != null && current.equals(seatPosition);
    }

    private boolean isSeatFoldedByHand(int seatPosition) {
        if (currentHand == null) {
            return false;
        }
        return currentHand.isSeatFolded(seatPosition);
    }

    private boolean canFold(int seatPosition) {
        if (!isSeatOnTurn(seatPosition) || currentHand == null) {
            return false;
        }
        Seat seat = getSeat(seatPosition);
        if (seat == null || !seat.isOccupied()) {
            return false;
        }
        return !isSeatFoldedByHand(seatPosition) && seat.getStack() > 0;
    }

    private boolean canCheck(int seatPosition) {
        if (!isSeatOnTurn(seatPosition) || currentHand == null) {
            return false;
        }
        long currentBet = getCurrentBet();
        return currentBet == 0L;
    }

    private boolean canCall(int seatPosition) {
        if (!isSeatOnTurn(seatPosition) || currentHand == null) {
            return false;
        }
        Seat seat = getSeat(seatPosition);
        if (seat == null || !seat.isOccupied()) {
            return false;
        }
        long betThisStreet = currentHand.getBetThisStreetForSeat(seatPosition);
        long toCall = getCurrentBet() - betThisStreet;
        return toCall > 0 && seat.getStack() > 0 && !isSeatFoldedByHand(seatPosition);
    }

    private boolean canBet(int seatPosition) {
        if (!isSeatOnTurn(seatPosition) || currentHand == null) {
            return false;
        }
        Seat seat = getSeat(seatPosition);
        if (seat == null || !seat.isOccupied()) {
            return false;
        }
        long currentBet = getCurrentBet();
        return currentBet == 0L && seat.getStack() > 0 && !isSeatFoldedByHand(seatPosition);
    }

    private boolean canRaise(int seatPosition) {
        if (!isSeatOnTurn(seatPosition) || currentHand == null) {
            return false;
        }
        Seat seat = getSeat(seatPosition);
        if (seat == null || !seat.isOccupied()) {
            return false;
        }
        long currentBet = getCurrentBet();
        return currentBet > 0L && seat.getStack() > 0 && !isSeatFoldedByHand(seatPosition);
    }

    private boolean canAllIn(int seatPosition) {
        if (!isSeatOnTurn(seatPosition) || currentHand == null) {
            return false;
        }
        Seat seat = getSeat(seatPosition);
        if (seat == null || !seat.isOccupied()) {
            return false;
        }
        return seat.getStack() > 0 && !isSeatFoldedByHand(seatPosition);
    }

    public void finishHandByShowdown(HoldemHand hand) {
    }

    public String buildLastResultText(HoldemHand hand) {
        return "Rozdanie zakonczone";
    }
}
