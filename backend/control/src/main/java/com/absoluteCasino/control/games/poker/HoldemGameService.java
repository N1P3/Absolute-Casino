package com.absoluteCasino.control.games.poker;

import com.absoluteCasino.control.utils.CardsShoe;
import com.absoluteCasino.control.utils.Seat;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class HoldemGameService {

    private final Map<Integer, HoldemTable> tables = new ConcurrentHashMap<>();
    private final Map<Integer, List<WaitingPlayer>> waitingPlayers = new ConcurrentHashMap<>();

    private final CardsShoe shoe = new CardsShoe(CardsShoe.NUMBER_OF_DECKS);
    private final AtomicInteger handIdSeq = new AtomicInteger(1);

    private final HoldemHandEvaluator handEvaluator = new HoldemHandEvaluator();

    public HoldemTable getTable(int tableId) {
        HoldemTable table = tables.get(tableId);
        if (table == null) {
            throw new IllegalArgumentException("Table not found: " + tableId);
        }
        return table;
    }

    public HoldemTable createTableIfAbsent(int tableId) {
        return tables.computeIfAbsent(tableId, id ->
                new HoldemTable(
                        id,
                        8,
                        new Blinds(10, 20),
                        1000L,
                        4000L
                )
        );
    }

    public void joinTable(int tableId, Long userId, long buyIn) {
        HoldemTable table = createTableIfAbsent(tableId);

        boolean alreadySeated = table.getSeats().stream()
                .anyMatch(seat -> seat.isOccupied() && userId.equals(seat.getUserId()));
        if (alreadySeated) {
            return;
        }

        Seat freeSeat = table.getSeats().stream()
                .filter(seat -> !seat.isOccupied())
                .findFirst()
                .orElse(null);

        boolean handInProgress = table.getStatus() == TableStatus.HAND_IN_PROGRESS;

        if (freeSeat != null && !handInProgress) {
            seatPlayer(table, freeSeat, userId, buyIn);
        } else {
            waitingPlayers.computeIfAbsent(tableId, id -> new ArrayList<>())
                    .add(new WaitingPlayer(userId, buyIn));
        }
    }

    public void leaveTable(int tableId, Long userId) {
        HoldemTable table = getTable(tableId);

        for (Seat seat : table.getSeats()) {
            if (userId.equals(seat.getUserId())) {
                seat.setUserId(null);
                seat.setStack(0);
                seat.setSittingOut(false);
                break;
            }
        }

        List<WaitingPlayer> queue = waitingPlayers.get(tableId);
        if (queue != null) {
            queue.removeIf(wp -> userId.equals(wp.userId()));
            if (queue.isEmpty()) {
                waitingPlayers.remove(tableId);
            }
        }
    }

    public void startHandIfPossible(int tableId) {
        HoldemTable table = tables.get(tableId);
        if (table == null) return;
        if (table.getCurrentHand() != null) return;

        long activePlayers = table.getActivePlayersCount();
        if (activePlayers < 2) return;

        HoldemHand hand = new HoldemHand(tableId, shoe);
        table.setCurrentHand(hand);

        List<Seat> activeSeats = table.getSeats().stream()
                .filter(Seat::isOccupied)
                .filter(seat -> !seat.isSittingOut())
                .toList();

        int dealerPos = getNextDealerPosition(table, activeSeats);
        table.setDealerPosition(dealerPos);

        postBlindsAndDeal(table, hand, activeSeats);
    }




    public void handlePlayerAction(int tableId,
                                   Long userId,
                                   PlayerActionType action,
                                   long amount) {

        HoldemTable table = getTable(tableId);
        HoldemHand hand = table.getCurrentHand();
        if (hand == null) {
            throw new IllegalStateException("No hand in progress");
        }

        Seat seat = findSeatByUserId(table, userId);
        PlayerHandState ps = hand.getPlayers().get(seat.getPosition());
        if (ps == null || ps.isFolded() || ps.isAllIn()) {
            return;
        }

        if (seat.getPosition() != hand.getCurrentPlayerSeat()) {
            throw new IllegalStateException("Not this player's turn");
        }

        switch (action) {
            case FOLD -> {
                ps.setFolded(true);
                table.setLastActionText("Seat " + seat.getPosition() + ": FOLD");
            }
            case CHECK -> {
                long toCall = hand.getCurrentBet() - ps.getChipsInPotThisStreet();
                if (toCall != 0) {
                    throw new IllegalStateException("Cannot check, need to call " + toCall);
                }
                table.setLastActionText("Seat " + seat.getPosition() + ": CHECK");
            }
            case CALL -> {
                long toCall = hand.getCurrentBet() - ps.getChipsInPotThisStreet();
                if (toCall > 0) {
                    takeChips(hand, seat, toCall);
                }
                table.setLastActionText("Seat " + seat.getPosition() + ": CALL " + toCall);
            }
            case BET -> {
                if (hand.getCurrentBet() != 0) {
                    throw new IllegalStateException("Cannot bet, bet already exists, use raise");
                }
                if (amount < table.getBlinds().bigBlind()) {
                    throw new IllegalArgumentException("Bet must be at least big blind");
                }
                long newBetAmount = amount;
                long toPutNow = newBetAmount;
                if (toPutNow <= 0) {
                    throw new IllegalArgumentException("Invalid bet amount");
                }
                takeChips(hand, seat, toPutNow);
                hand.setCurrentBet(newBetAmount);
                table.setLastActionText("Seat " + seat.getPosition() + ": BET " + newBetAmount);
            }
            case RAISE -> {
                if (hand.getCurrentBet() == 0) {
                    throw new IllegalStateException("Cannot raise, there is no bet, use bet");
                }
                if (amount <= hand.getCurrentBet()) {
                    throw new IllegalArgumentException("Raise must be greater than current bet");
                }
                long newBetAmount = amount;
                long alreadyPut = ps.getChipsInPotThisStreet();
                long toPutNow = newBetAmount - alreadyPut;
                if (toPutNow <= 0) {
                    throw new IllegalArgumentException("Invalid raise amount");
                }
                if (toPutNow < table.getBlinds().bigBlind()) {
                    throw new IllegalArgumentException("Raise must be at least big blind");
                }
                takeChips(hand, seat, toPutNow);
                hand.setCurrentBet(newBetAmount);
                table.setLastActionText("Seat " + seat.getPosition() + ": RAISE do " + newBetAmount);
            }
            case ALL_IN -> {
                long newBetAmount = ps.getChipsInPotThisStreet() + seat.getStack();
                long toPutNow = seat.getStack();
                if (toPutNow > 0) {
                    takeChips(hand, seat, toPutNow);
                    if (newBetAmount > hand.getCurrentBet()) {
                        hand.setCurrentBet(newBetAmount);
                    }
                }
                table.setLastActionText("Seat " + seat.getPosition() + ": ALL-IN");
            }
        }


        if (isHandEndedByFolds(hand)) {
            finishHandByFolds(table, hand);
        } else if (isBettingRoundEnded(table, hand)) {
            advanceStreet(table, hand);
        } else {
            moveToNextPlayer(table, hand);
        }
    }
    private void scheduleNextHand(int tableId) {
        new Thread(() -> {
            try {
                Thread.sleep(3000L);
            } catch (InterruptedException ignored) {
            }
            try {
                startHandIfPossible(tableId);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private void seatPlayer(HoldemTable table, Seat seat, Long userId, long buyIn) {
        seat.setUserId(userId);
        seat.setStack(buyIn);
        seat.setSittingOut(false);
    }

    private Seat findSeatByUserId(HoldemTable table, Long userId) {
        return table.getSeats().stream()
                .filter(Seat::isOccupied)
                .filter(seat -> userId.equals(seat.getUserId()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "User " + userId + " is not seated at table " + table.getTableId()
                ));
    }

    private int getNextDealerPosition(HoldemTable table, List<Seat> activeSeats) {
        int currentDealer = table.getDealerPosition();
        if (currentDealer == -1) {
            return activeSeats.getFirst().getPosition();
        }
        return getNextOccupiedSeat(table, currentDealer, activeSeats).getPosition();
    }

    private Seat getNextOccupiedSeat(HoldemTable table,
                                     int startPosition,
                                     List<Seat> activeSeats) {
        int maxSeats = table.getMaxSeats();
        int pos = startPosition;
        while (true) {
            pos = (pos + 1) % maxSeats;
            int finalPos = pos;
            Seat seat = activeSeats.stream()
                    .filter(s -> s.getPosition() == finalPos)
                    .findFirst()
                    .orElse(null);
            if (seat != null) {
                return seat;
            }
        }
    }

    private void postBlindsAndDeal(HoldemTable table,
                                   HoldemHand hand,
                                   List<Seat> activeSeats) {

        long smallBlind = table.getBlinds().smallBlind();
        long bigBlind   = table.getBlinds().bigBlind();

        int dealerPos   = table.getDealerPosition();

        Seat smallBlindSeat = getNextOccupiedSeat(table, dealerPos, activeSeats);
        Seat bigBlindSeat   = getNextOccupiedSeat(table, smallBlindSeat.getPosition(), activeSeats);

        takeChips(hand, smallBlindSeat, smallBlind);
        takeChips(hand, bigBlindSeat, bigBlind);

        hand.setCurrentBet(bigBlind);
        hand.setPot(smallBlind + bigBlind);
        hand.setStreet(BettingStreet.PREFLOP);

        for (Seat seat : activeSeats) {
            PlayerHandState ps = new PlayerHandState(seat.getPosition());
            ps.setHole1(hand.getShoe().getCard());
            ps.setHole2(hand.getShoe().getCard());
            hand.getPlayers().put(seat.getPosition(), ps);
        }

        Seat firstToAct = getNextOccupiedSeat(table, bigBlindSeat.getPosition(), activeSeats);
        hand.setCurrentPlayerSeat(firstToAct.getPosition());
    }

    private void takeChips(HoldemHand hand,
                           Seat seat,
                           long amount) {

        PlayerHandState ps = hand.getPlayers()
                .computeIfAbsent(seat.getPosition(), PlayerHandState::new);

        long available = seat.getStack();
        long toTake = Math.min(available, amount);

        seat.setStack(available - toTake);

        ps.setTotalChipsInPot(ps.getTotalChipsInPot() + toTake);
        ps.setChipsInPotThisStreet(ps.getChipsInPotThisStreet() + toTake);

        if (seat.getStack() == 0) {
            ps.setAllIn(true);
        }

        hand.setPot(hand.getPot() + toTake);
    }

    private boolean isHandEndedByFolds(HoldemHand hand) {
        long notFolded = hand.getPlayers().values().stream()
                .filter(ps -> !ps.isFolded())
                .count();
        return notFolded <= 1;
    }

    private boolean isBettingRoundEnded(HoldemTable table, HoldemHand hand) {
        long notFolded = hand.getPlayers().values().stream()
                .filter(ps -> !ps.isFolded())
                .count();

        if (notFolded <= 1) {
            return true;
        }

        long toActCount = hand.getPlayers().values().stream()
                .filter(ps -> !ps.isFolded())
                .filter(ps -> !ps.isAllIn())
                .filter(ps -> ps.getChipsInPotThisStreet() != hand.getCurrentBet())
                .count();

        return toActCount == 0;
    }

    private void advanceStreet(HoldemTable table, HoldemHand hand) {
        hand.setCurrentBet(0);
        hand.getPlayers().values().forEach(ps -> ps.setChipsInPotThisStreet(0));

        switch (hand.getStreet()) {
            case PREFLOP -> {
                hand.getCommunityCards().add(hand.getShoe().getCard());
                hand.getCommunityCards().add(hand.getShoe().getCard());
                hand.getCommunityCards().add(hand.getShoe().getCard());
                hand.setStreet(BettingStreet.FLOP);
                moveToNextPlayer(table, hand);
            }
            case FLOP -> {
                hand.getCommunityCards().add(hand.getShoe().getCard());
                hand.setStreet(BettingStreet.TURN);
                moveToNextPlayer(table, hand);
            }
            case TURN -> {
                hand.getCommunityCards().add(hand.getShoe().getCard());
                hand.setStreet(BettingStreet.RIVER);
                moveToNextPlayer(table, hand);
            }
            case RIVER -> {
                hand.setStreet(BettingStreet.SHOWDOWN);
                finishHandByShowdown(table, hand);
            }
            default -> {
            }
        }
    }

    private void moveToNextPlayer(HoldemTable table, HoldemHand hand) {
        List<Seat> activeSeats = table.getSeats().stream()
                .filter(Seat::isOccupied)
                .filter(seat -> !seat.isSittingOut())
                .filter(seat -> {
                    PlayerHandState ps = hand.getPlayers().get(seat.getPosition());
                    return ps != null && !ps.isFolded() && !ps.isAllIn();
                })
                .toList();


        if (activeSeats.isEmpty()) {
            finishHandByFolds(table, hand);
            return;
        }

        int maxSeats = table.getMaxSeats();
        int pos = hand.getCurrentPlayerSeat();
        while (true) {
            pos = (pos + 1) % maxSeats;
            int finalPos = pos;
            boolean found = activeSeats.stream()
                    .anyMatch(s -> s.getPosition() == finalPos);
            if (found) {
                hand.setCurrentPlayerSeat(finalPos);
                return;
            }
        }
    }

    private void finishHandByFolds(HoldemTable table, HoldemHand hand) {
        PlayerHandState winner = hand.getPlayers().values().stream()
                .filter(ps -> !ps.isFolded())
                .findFirst()
                .orElse(null);
        if (winner != null) {
            Seat winnerSeat = table.getSeats().stream()
                    .filter(seat -> seat.getPosition() == winner.getSeatPosition())
                    .findFirst()
                    .orElse(null);
            if (winnerSeat != null) {
                winnerSeat.setStack(winnerSeat.getStack() + hand.getPot());
            }
        }
        endHandAndMoveWaitingPlayers(table);
        scheduleNextHand(table.getTableId());

    }

    private void finishHandByShowdown(HoldemTable table, HoldemHand hand) {
        List<PlayerHandState> contenders = hand.getPlayers().values().stream()
                .filter(ps -> !ps.isFolded())
                .toList();

        if (contenders.isEmpty()) {
            endHandAndMoveWaitingPlayers(table);
            return;
        }

        Map<Integer, Long> committed = new HashMap<>();
        for (PlayerHandState ps : hand.getPlayers().values()) {
            committed.put(ps.getSeatPosition(), ps.getTotalChipsInPot());
        }

        List<SidePot> pots = buildSidePots(committed);

        Map<Integer, Integer> seatToRank = new HashMap<>();
        for (PlayerHandState ps : contenders) {
            Seat seat = table.getSeats().stream()
                    .filter(s -> s.getPosition() == ps.getSeatPosition())
                    .findFirst()
                    .orElse(null);
            if (seat == null || seat.getUserId() == null) continue;

            List<String> hole = List.of(ps.getHole1(), ps.getHole2());
            int rank = handEvaluator.evaluateHand(hole, hand.getCommunityCards());
            seatToRank.put(ps.getSeatPosition(), rank);
        }

        for (SidePot pot : pots) {
            List<PlayerHandState> eligible = contenders.stream()
                    .filter(ps -> ps.getTotalChipsInPot() > 0)
                    .filter(ps -> pot.eligibleSeats.contains(ps.getSeatPosition()))
                    .toList();

            if (eligible.isEmpty()) continue;

            int bestRank = Integer.MAX_VALUE;
            for (PlayerHandState ps : eligible) {
                Integer r = seatToRank.get(ps.getSeatPosition());
                if (r != null && r < bestRank) bestRank = r;
            }

            List<PlayerHandState> winners = new ArrayList<>();
            for (PlayerHandState ps : eligible) {
                Integer r = seatToRank.get(ps.getSeatPosition());
                if (r != null && r == bestRank) {
                    winners.add(ps);
                }
            }

            long amount = pot.amount;
            long share = amount / winners.size();
            long remainder = amount % winners.size();

            for (int i = 0; i < winners.size(); i++) {
                PlayerHandState ps = winners.get(i);
                Seat winnerSeat = table.getSeats().stream()
                        .filter(seat -> seat.getPosition() == ps.getSeatPosition())
                        .findFirst()
                        .orElse(null);
                if (winnerSeat != null) {
                    long win = share + (i == 0 ? remainder : 0);
                    winnerSeat.setStack(winnerSeat.getStack() + win);
                }
            }
        }

        endHandAndMoveWaitingPlayers(table);
        scheduleNextHand(table.getTableId());

    }

    private List<SidePot> buildSidePots(Map<Integer, Long> committed) {
        List<SidePot> pots = new ArrayList<>();
        Map<Integer, Long> remaining = new HashMap<>(committed);

        while (true) {
            long min = remaining.values().stream()
                    .filter(v -> v > 0)
                    .min(Long::compareTo)
                    .orElse(0L);

            if (min == 0) break;

            List<Integer> contributors = new ArrayList<>();
            long potAmount = 0;

            for (Map.Entry<Integer, Long> e : remaining.entrySet()) {
                long v = e.getValue();
                if (v <= 0) continue;
                long take = Math.min(v, min);
                if (take > 0) {
                    potAmount += take;
                    contributors.add(e.getKey());
                    remaining.put(e.getKey(), v - take);
                }
            }

            if (potAmount > 0 && !contributors.isEmpty()) {
                pots.add(new SidePot(potAmount, new HashSet<>(contributors)));
            }
        }

        return pots;
    }

    private void endHandAndMoveWaitingPlayers(HoldemTable table) {
        table.setCurrentHand(null);
        table.setStatus(TableStatus.WAITING_FOR_NEXT_HAND);
        moveWaitingPlayersToSeats(table);
    }

    private void moveWaitingPlayersToSeats(HoldemTable table) {
        int tableId = table.getTableId();
        List<WaitingPlayer> queue = waitingPlayers.get(tableId);
        if (queue == null || queue.isEmpty()) {
            return;
        }

        for (Seat seat : table.getSeats()) {
            if (queue.isEmpty()) break;
            if (seat.isOccupied()) continue;

            WaitingPlayer wp = queue.removeFirst();
            seatPlayer(table, seat, wp.userId(), wp.buyIn());
        }

        if (queue.isEmpty()) {
            waitingPlayers.remove(tableId);
        }
    }
    public void setSittingOut(int tableId, Long userId, boolean sittingOut) {
        HoldemTable table = getTable(tableId);
        for (Seat seat : table.getSeats()) {
            if (userId.equals(seat.getUserId())) {
                seat.setSittingOut(sittingOut);
                break;
            }
        }
    }


    private record WaitingPlayer(Long userId, long buyIn) { }

    private record SidePot(long amount, Set<Integer> eligibleSeats) { }
}

