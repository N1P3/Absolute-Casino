package com.absoluteCasino.control.games.poker;

import com.absoluteCasino.control.utils.CardsShoe;
import com.absoluteCasino.control.utils.Seat;
import lombok.Getter;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class HoldemGameService {

    private final Map<Integer, HoldemTable> tables = new ConcurrentHashMap<>();
    private final Map<Integer, List<WaitingPlayer>> waitingPlayers = new ConcurrentHashMap<>();

    private CardsShoe shoe = new CardsShoe(1);
    private final HoldemHandEvaluator handEvaluator = new HoldemHandEvaluator();
    private final HoldemAI holdemAI = new HoldemAI();

    @Getter
    private final int maxSeatsPerTable = 8;

    public HoldemTable getTable(int tableId) {
        HoldemTable table = tables.get(tableId);
        if (table == null) {
            throw new IllegalArgumentException("Table not found: " + tableId);
        }
        return table;
    }

    public HoldemTable createTableIfAbsent(int tableId) {
        return tables.computeIfAbsent(tableId, id -> new HoldemTable(
                id,
                maxSeatsPerTable,
                new Blinds(10, 20),
                1000L,
                4000L));
    }

    public synchronized void joinTable(int tableId, Long userId, long buyIn) {
        HoldemTable table = createTableIfAbsent(tableId);

        Seat existingSeat = table.getSeats().stream()
                .filter(seat -> seat.isOccupied() && userId.equals(seat.getUserId()))
                .findFirst()
                .orElse(null);

        if (existingSeat != null) {
            existingSeat.setSittingOut(false);
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

    public synchronized void addAiPlayer(int tableId) {
        HoldemTable table = createTableIfAbsent(tableId);
        Seat freeSeat = table.getSeats().stream()
                .filter(seat -> !seat.isOccupied())
                .findFirst()
                .orElse(null);
        if (freeSeat != null) {
            long aiId = -System.currentTimeMillis();
            freeSeat.setUserId(aiId);
            freeSeat.setStack(1000L);
            freeSeat.setSittingOut(false);
            freeSeat.setAi(true);
        }
    }

    public synchronized void rebuy(int tableId, Long userId, long amount) {
        if (amount <= 0) {
            return;
        }
        HoldemTable table = getTable(tableId);
        for (Seat seat : table.getSeats()) {
            if (userId.equals(seat.getUserId())) {
                seat.setStack(seat.getStack() + amount);
                return;
            }
        }
    }

    public synchronized void leaveTable(int tableId, Long userId) {
        HoldemTable table = getTable(tableId);

        // Check if player is in active hand
        if (table.getCurrentHand() != null) {
            Seat seat = findSeatByUserId(table, userId);
            if (seat != null) {
                PlayerHandState ps = table.getCurrentHand().getPlayers().get(seat.getPosition());
                if (ps != null && !ps.isFolded()) {
                    ps.setFolded(true);
                    ps.setActedThisStreet(true);
                    table.setLastActionText("Seat " + seat.getPosition() + ": FOLD (Left Table)");

                    // If it was their turn, we need to advance the game state
                    if (table.getCurrentHand().getCurrentPlayerSeat() == seat.getPosition()) {
                        // Logic to move next will be handled by check at end of method or explicit
                        // call?
                        // Actually, we should just let the normal flow handle it if possible,
                        // but since this is a void method, we might need to trigger state update.
                        // However, leaveTable is usually called from outside the game loop.
                        // Let's trigger a check.
                        checkGameProgress(table, table.getCurrentHand());
                    }
                }
            }
        }

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

    private void checkGameProgress(HoldemTable table, HoldemHand hand) {
        if (isHandEndedByFolds(hand)) {
            finishHandByFolds(table, hand);
        } else if (isBettingRoundEnded(table, hand)) {
            advanceStreet(table, hand);
        } else {
            moveToNextPlayer(table, hand);
        }
    }

    public synchronized void startHandIfPossible(int tableId) {
        HoldemTable table = tables.get(tableId);
        if (table == null) {
            return;
        }
        if (table.getCurrentHand() != null) {
            return;
        }

        long activePlayers = table.getActivePlayersCount();
        if (activePlayers < 2) {
            return;
        }
        shoe = new CardsShoe(1);
        HoldemHand hand = new HoldemHand(tableId, shoe);
        table.setCurrentHand(hand);

        List<Seat> activeSeats = table.getSeats().stream()
                .filter(Seat::isOccupied)
                .filter(seat -> !seat.isSittingOut())
                .toList();
        if (activeSeats.size() < 2) {
            return;
        }

        int dealerPos = getNextDealerPosition(table, activeSeats);
        table.setDealerPosition(dealerPos);

        postBlindsAndDeal(table, hand, activeSeats);
        table.setStatus(TableStatus.HAND_IN_PROGRESS);
    }

    public synchronized String handlePlayerAction(int tableId,
            Long userId,
            PlayerActionType action,
            long amount) {

        HoldemTable table = getTable(tableId);
        HoldemHand hand = table.getCurrentHand();
        if (hand == null) {
            return "Brak aktywnej ręki";
        }

        Seat seat = findSeatByUserId(table, userId);
        PlayerHandState ps = hand.getPlayers().get(seat.getPosition());
        if (ps == null || ps.isFolded() || ps.isAllIn()) {
            System.out.println("ACTION ERROR: User " + userId + " Seat " + seat.getPosition());
            System.out.println("PS: " + ps);
            if (ps != null) {
                System.out.println("Folded: " + ps.isFolded() + " AllIn: " + ps.isAllIn());
            }
            return "Gracz nie jest aktywny w rozdaniu";
        }

        if (seat.getPosition() != hand.getCurrentPlayerSeat()) {
            return "To nie jest tura tego gracza";
        }

        switch (action) {
            case FOLD -> {
                ps.setFolded(true);
                ps.setActedThisStreet(true);
                table.setLastActionText("Seat " + seat.getPosition() + ": FOLD");
                hand.getActionHistory().add(new HoldemHand.ActionRecord(seat.getPosition(), PlayerActionType.FOLD, 0));
            }
            case CHECK -> {
                long toCall = hand.getCurrentBet() - ps.getChipsInPotThisStreet();
                if (toCall != 0) {
                    return "Nie możesz checkować, musisz sprawdzić " + toCall;
                }
                ps.setActedThisStreet(true);
                table.setLastActionText("Seat " + seat.getPosition() + ": CHECK");
                hand.getActionHistory().add(new HoldemHand.ActionRecord(seat.getPosition(), PlayerActionType.CHECK, 0));
            }
            case CALL -> {
                long toCall = hand.getCurrentBet() - ps.getChipsInPotThisStreet();
                if (toCall <= 0) {
                    return "Nie ma nic do sprawdzenia";
                }
                if (seat.getStack() <= 0) {
                    return "Brak żetonów na call";
                }
                takeChips(hand, seat, toCall);
                ps.setActedThisStreet(true);
                table.setLastActionText("Seat " + seat.getPosition() + ": CALL " + toCall);
                hand.getActionHistory()
                        .add(new HoldemHand.ActionRecord(seat.getPosition(), PlayerActionType.CALL, toCall));
            }
            case BET -> {
                if (hand.getCurrentBet() != 0) {
                    return "Nie możesz betować, istnieje już bet – użyj raise";
                }
                if (amount < table.getBlinds().bigBlind()) {
                    return "Bet musi być co najmniej big blind (" + table.getBlinds().bigBlind() + ")";
                }
                long newBetAmount = amount;
                long toPutNow = newBetAmount;
                if (toPutNow <= 0) {
                    return "Nieprawidłowa kwota betu";
                }
                if (seat.getStack() < toPutNow) {
                    return "Nie masz wystarczających żetonów na bet";
                }
                takeChips(hand, seat, toPutNow);
                hand.setCurrentBet(newBetAmount);
                ps.setActedThisStreet(true);
                table.setLastActionText("Seat " + seat.getPosition() + ": BET " + newBetAmount);
                hand.getActionHistory()
                        .add(new HoldemHand.ActionRecord(seat.getPosition(), PlayerActionType.BET, newBetAmount));
            }
            case RAISE -> {
                if (hand.getCurrentBet() == 0) {
                    return "Nie możesz raisować, nie ma betu – użyj bet";
                }

                long minRaise = Math.max(table.getBlinds().bigBlind(), hand.getLastRaiseSize());
                long minTotal = hand.getCurrentBet() + minRaise;

                if (amount < minTotal) {
                    return "Raise musi być do co najmniej " + minTotal + " (min przebicie: " + minRaise + ")";
                }

                long newBetAmount = amount;
                long alreadyPut = ps.getChipsInPotThisStreet();
                long toPutNow = newBetAmount - alreadyPut;

                if (toPutNow <= 0) {
                    return "Nieprawidłowa kwota raisu";
                }
                if (seat.getStack() < toPutNow) {
                    return "Nie masz wystarczających żetonów na raise";
                }

                long raiseSize = newBetAmount - hand.getCurrentBet();

                takeChips(hand, seat, toPutNow);
                hand.setCurrentBet(newBetAmount);
                hand.setLastRaiseSize(raiseSize);
                ps.setActedThisStreet(true);
                table.setLastActionText("Seat " + seat.getPosition() + ": RAISE do " + newBetAmount);
                hand.getActionHistory()
                        .add(new HoldemHand.ActionRecord(seat.getPosition(), PlayerActionType.RAISE, newBetAmount));
            }
            case ALL_IN -> {
                if (seat.getStack() <= 0) {
                    return "Brak żetonów na all-in";
                }
                long newBetAmount = ps.getChipsInPotThisStreet() + seat.getStack();
                long toPutNow = seat.getStack();
                takeChips(hand, seat, toPutNow);
                if (newBetAmount > hand.getCurrentBet()) {
                    hand.setCurrentBet(newBetAmount);
                }
                ps.setActedThisStreet(true);
                table.setLastActionText("Seat " + seat.getPosition() + ": ALL-IN");
                hand.getActionHistory()
                        .add(new HoldemHand.ActionRecord(seat.getPosition(), PlayerActionType.ALL_IN, toPutNow));
            }
        }

        checkGameProgress(table, hand);

        return null;
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
                        "User " + userId + " is not seated at table " + table.getTableId()));
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
        long bigBlind = table.getBlinds().bigBlind();

        int dealerPos = table.getDealerPosition();

        Seat smallBlindSeat = getNextOccupiedSeat(table, dealerPos, activeSeats);
        Seat bigBlindSeat = getNextOccupiedSeat(table, smallBlindSeat.getPosition(), activeSeats);

        takeChips(hand, smallBlindSeat, smallBlind);
        takeChips(hand, bigBlindSeat, bigBlind);

        hand.setCurrentBet(bigBlind);
        hand.setLastRaiseSize(bigBlind); // Initial bet is considered a raise of BB size
        hand.setPot(smallBlind + bigBlind);
        hand.setStreet(BettingStreet.PREFLOP);

        for (Seat seat : activeSeats) {
            PlayerHandState ps = new PlayerHandState(seat.getPosition());
            ps.setHole1(hand.getShoe().getCard());
            ps.setHole2(hand.getShoe().getCard());
            ps.setActedThisStreet(false);
            hand.getPlayers().put(seat.getPosition(), ps);
        }

        Seat firstToAct = getNextOccupiedSeat(table, bigBlindSeat.getPosition(), activeSeats);
        hand.setCurrentPlayerSeat(firstToAct.getPosition());
        if (firstToAct.isAi()) {
            java.util.concurrent.CompletableFuture.runAsync(() -> processAiTurn(table));
        }
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
        List<PlayerHandState> active = hand.getPlayers().values().stream()
                .filter(ps -> !ps.isFolded())
                .filter(ps -> !ps.isAllIn())
                .toList();

        if (active.size() <= 1) {
            return true;
        }

        if (hand.getCurrentBet() == 0) {
            boolean everyoneActed = active.stream().allMatch(PlayerHandState::isActedThisStreet);
            return everyoneActed;
        } else {
            long toActCount = active.stream()
                    .filter(ps -> ps.getChipsInPotThisStreet() != hand.getCurrentBet())
                    .count();
            return toActCount == 0;
        }
    }

    private void advanceStreet(HoldemTable table, HoldemHand hand) {
        hand.setCurrentBet(0);
        hand.setLastRaiseSize(table.getBlinds().bigBlind()); // Reset min raise to BB for new street
        hand.getPlayers().values().forEach(ps -> {
            ps.setChipsInPotThisStreet(0);
            ps.setActedThisStreet(false);
        });

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
            // Check if we have players for a showdown (All-In situation)
            long notFoldedCount = hand.getPlayers().values().stream()
                    .filter(ps -> !ps.isFolded())
                    .count();

            if (notFoldedCount > 1) {
                // Everyone is All-In (or 1 active + rest All-In and active just acted)
                dealRemainingCardsAndShowdown(table, hand);
            } else {
                finishHandByFolds(table, hand);
            }
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

                // Trigger AI if it's their turn
                Seat nextSeat = table.getSeat(finalPos);
                if (nextSeat != null && nextSeat.isAi()) {
                    java.util.concurrent.CompletableFuture.runAsync(() -> processAiTurn(table));
                }
                return;
            }
        }
    }

    private void dealRemainingCardsAndShowdown(HoldemTable table, HoldemHand hand) {
        // Deal remaining cards until River
        while (hand.getStreet() != BettingStreet.RIVER) {
            switch (hand.getStreet()) {
                case PREFLOP -> {
                    hand.getCommunityCards().add(hand.getShoe().getCard());
                    hand.getCommunityCards().add(hand.getShoe().getCard());
                    hand.getCommunityCards().add(hand.getShoe().getCard());
                    hand.setStreet(BettingStreet.FLOP);
                }
                case FLOP -> {
                    hand.getCommunityCards().add(hand.getShoe().getCard());
                    hand.setStreet(BettingStreet.TURN);
                }
                case TURN -> {
                    hand.getCommunityCards().add(hand.getShoe().getCard());
                    hand.setStreet(BettingStreet.RIVER);
                }
            }
        }

        // Final state
        hand.setStreet(BettingStreet.SHOWDOWN);
        finishHandByShowdown(table, hand);
    }

    private void finishHandByFolds(HoldemTable table, HoldemHand hand) {
        PlayerHandState winner = hand.getPlayers().values().stream()
                .filter(ps -> !ps.isFolded())
                .findFirst()
                .orElse(null);

        long pot = hand.getPot();
        String resultText = "Nikt nie wygrał";

        if (winner != null) {
            Seat winnerSeat = table.getSeats().stream()
                    .filter(seat -> seat.getPosition() == winner.getSeatPosition())
                    .findFirst()
                    .orElse(null);
            if (winnerSeat != null) {
                winnerSeat.setStack(winnerSeat.getStack() + pot);
                resultText = "Seat " + winner.getSeatPosition() + " wygrał " + pot;
            }
        }

        finishHandAndScheduleNext(table, resultText);
    }

    private void finishHandByShowdown(HoldemTable table, HoldemHand hand) {
        List<PlayerHandState> contenders = hand.getPlayers().values().stream()
                .filter(ps -> !ps.isFolded())
                .toList();

        if (contenders.isEmpty()) {
            finishHandAndScheduleNext(table, "Brak contenderów");
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
            if (seat == null || seat.getUserId() == null)
                continue;

            List<String> hole = List.of(ps.getHole1(), ps.getHole2());
            int rank = handEvaluator.evaluateHand(hole, hand.getCommunityCards());
            seatToRank.put(ps.getSeatPosition(), rank);
        }

        Map<Integer, Long> wins = new HashMap<>();

        for (SidePot pot : pots) {
            List<PlayerHandState> eligible = contenders.stream()
                    .filter(ps -> ps.getTotalChipsInPot() > 0)
                    .filter(ps -> pot.eligibleSeats.contains(ps.getSeatPosition()))
                    .toList();

            if (eligible.isEmpty())
                continue;

            int bestRank = Integer.MAX_VALUE;
            for (PlayerHandState ps : eligible) {
                Integer r = seatToRank.get(ps.getSeatPosition());
                if (r != null && r < bestRank)
                    bestRank = r;
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
                    wins.merge(ps.getSeatPosition(), win, Long::sum);
                }
            }
        }

        StringBuilder sb = new StringBuilder("Showdown: ");
        boolean first = true;
        for (Map.Entry<Integer, Long> e : wins.entrySet()) {
            if (!first)
                sb.append(" | ");
            sb.append("Seat ").append(e.getKey()).append(" +").append(e.getValue());
            first = false;
        }
        if (first) {
            sb.append("brak wygranych");
        }

        finishHandAndScheduleNext(table, sb.toString());
    }

    private List<SidePot> buildSidePots(Map<Integer, Long> committed) {
        List<SidePot> pots = new ArrayList<>();
        Map<Integer, Long> remaining = new HashMap<>(committed);

        while (true) {
            long min = remaining.values().stream()
                    .filter(v -> v > 0)
                    .min(Long::compareTo)
                    .orElse(0L);

            if (min == 0)
                break;

            List<Integer> contributors = new ArrayList<>();
            long potAmount = 0;

            for (Map.Entry<Integer, Long> e : remaining.entrySet()) {
                long v = e.getValue();
                if (v <= 0)
                    continue;
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

    public interface GameUpdateListener {
        void onUpdate(int tableId);
    }

    private GameUpdateListener updateListener;

    public void setUpdateListener(GameUpdateListener listener) {
        this.updateListener = listener;
    }

    private void notifyUpdate(int tableId) {
        if (updateListener != null) {
            updateListener.onUpdate(tableId);
        }
    }

    private void finishHandAndScheduleNext(HoldemTable table, String resultText) {
        table.setLastResultText(resultText);
        table.setLastResultTimestamp(System.currentTimeMillis());
        endHandAndMoveWaitingPlayers(table);

        // Notify immediately to show showdown results
        notifyUpdate(table.getTableId());

        int tableId = table.getTableId();
        new Thread(() -> {
            try {
                Thread.sleep(3000L);
            } catch (InterruptedException ignored) {
            }
            try {
                startHandIfPossible(tableId);
                // Notify after starting new hand (or not) to update state
                notifyUpdate(tableId);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
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
            if (queue.isEmpty())
                break;
            if (seat.isOccupied())
                continue;

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

    private record WaitingPlayer(Long userId, long buyIn) {
    }

    private record SidePot(long amount, Set<Integer> eligibleSeats) {
    }

    private void processAiTurn(HoldemTable table) {
        try {
            // Wait a bit for realism
            Thread.sleep(1000);

            Seat aiSeat = table.getSeat(table.getCurrentPlayerSeat());
            if (aiSeat == null || !aiSeat.isAi())
                return;

            HoldemAI.AIAction action = holdemAI.predictMove(table, aiSeat);

            if (action == null) {
                // Fallback: Check or Fold
                handlePlayerAction(table.getTableId(), aiSeat.getUserId(), PlayerActionType.FOLD, 0);
                return;
            }

            handlePlayerAction(table.getTableId(), aiSeat.getUserId(), action.type, action.raiseAmount);

            // Notify listener (WebSocket) to broadcast update
            notifyUpdate(table.getTableId());

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
