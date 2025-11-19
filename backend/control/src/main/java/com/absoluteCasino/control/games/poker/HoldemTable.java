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

    public int getSmallBlind() {
        return Math.toIntExact(blinds.smallBlind());
    }

    public int getBigBlind() {
        return Math.toIntExact(blinds.bigBlind());
    }

    public long getPot() {
        return currentHand != null ? currentHand.getPot() : 0L;
    }

    public long getCurrentBet() {
        return currentHand != null ? currentHand.getCurrentBet() : 0L;
    }

    public BettingStreet getStreet() {
        return currentHand != null ? currentHand.getStreet() : null;
    }

    public Integer getCurrentPlayerSeat() {
        return currentHand != null ? currentHand.getCurrentPlayerSeat() : null;
    }

    public Integer getDealerSeat() {
        return dealerPosition;
    }

    public List<String> getCommunityCards() {
        if (currentHand == null) {
            return List.of();
        }
        return currentHand.getCommunityCards();
    }

    public HoldemHand getCurrentHand() {
        return currentHand;
    }

    public List<Seat> getSeats() {
        return seats;
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

    public int getSeatPositionByUserId(Long userId) {
        if (userId == null) {
            return -1;
        }
        for (Seat seat : seats) {
            if (seat.isOccupied() && userId.equals(seat.getUserId())) {
                return seat.getPosition();
            }
        }
        return -1;
    }

    public Seat findSeatByUserId(Long userId) {
        if (userId == null) {
            return null;
        }
        for (Seat seat : seats) {
            if (seat.isOccupied() && userId.equals(seat.getUserId())) {
                return seat;
            }
        }
        return null;
    }

    public List<String> getViewerHoleCards(Seat viewerSeat) {
        if (currentHand == null || viewerSeat == null) {
            return List.of();
        }
        return currentHand.getHoleCardsForSeat(viewerSeat.getPosition());
    }

    public void setCurrentHand(HoldemHand hand) {
        this.currentHand = hand;
    }

    public void setDealerPosition(int dealerPosition) {
        this.dealerPosition = dealerPosition;
    }

    public void setLastResultText(String lastResultText) {
        this.lastResultText = lastResultText;
    }

    public void setLastResultTimestamp(long lastResultTimestamp) {
        this.lastResultTimestamp = lastResultTimestamp;
    }

    public void sitPlayer(Long userId, long buyIn) {
        for (Seat seat : seats) {
            if (!seat.isOccupied()) {
                seat.setUserId(userId);
                seat.setStack(buyIn);
                return;
            }
        }
    }

    public void leavePlayer(Long userId) {
        for (Seat seat : seats) {
            if (seat.isOccupied() && userId.equals(seat.getUserId())) {
                seat.setUserId(null);
                seat.setStack(0L);
                break;
            }
        }
    }

    public void setSittingOut(Long userId, boolean sittingOut) {
        for (Seat seat : seats) {
            if (seat.isOccupied() && userId.equals(seat.getUserId())) {
                seat.setSittingOut(sittingOut);
                break;
            }
        }
    }

    public void startNewHand(HoldemHand hand) {
        this.currentHand = hand;
        this.status = TableStatus.HAND_IN_PROGRESS;
    }

    public List<String> getAvailableActionsForSeat(Integer seatPosition) {
        List<String> actions = new ArrayList<>();
        if (seatPosition == null) {
            return actions;
        }
        if (currentHand == null) {
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
