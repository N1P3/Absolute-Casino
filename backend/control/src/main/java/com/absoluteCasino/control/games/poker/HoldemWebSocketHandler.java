package com.absoluteCasino.control.games.poker;

import com.absoluteCasino.control.user.BalanceUpdateManager;
import com.absoluteCasino.control.utils.JWTExtractor;
import com.absoluteCasino.control.utils.Seat;
import com.absoluteCasino.security.JWTUtil;
import com.absoluteCasino.user.UserDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Log
@Component
public class HoldemWebSocketHandler extends TextWebSocketHandler {

    private static final long ACTION_TIMEOUT_MS = 200_000L;
    private final Map<Integer, Thread> tableTimers = new ConcurrentHashMap<>();

    private final JWTUtil jwtUtil;
    private final BalanceUpdateManager balanceUpdateManager;
    private final HoldemGameService holdemGameService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, Long> sessionToUserMap = new ConcurrentHashMap<>();
    private final Map<Long, WebSocketSession> userSessions = new ConcurrentHashMap<>();
    private final Map<Long, Integer> userCurrentTable = new ConcurrentHashMap<>();

    @Autowired
    public HoldemWebSocketHandler(JWTUtil jwtUtil,
                                  BalanceUpdateManager balanceUpdateManager,
                                  HoldemGameService holdemGameService) {
        this.jwtUtil = jwtUtil;
        this.balanceUpdateManager = balanceUpdateManager;
        this.holdemGameService = holdemGameService;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
        String token = JWTExtractor.extractJwtFromSession(session);
        if (token == null || token.isEmpty()) {
            session.close();
            return;
        }

        try {
            UserDto user = jwtUtil.extractUser(token);
            if (user == null) {
                session.close();
                return;
            }

            Long userId = user.getId().longValue();
            sessionToUserMap.put(session.getId(), userId);
            userSessions.put(userId, session);

            session.sendMessage(new TextMessage("{\"type\":\"CONNECTED\"}"));
            log.info("User " + userId + " connected to Hold'em");
        } catch (Exception e) {
            log.severe("Error in afterConnectionEstablished: " + e.getMessage());
            session.close();
        }
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session,
                                     @NonNull TextMessage message) throws Exception {

        Long userId = sessionToUserMap.get(session.getId());
        if (userId == null) {
            session.sendMessage(error("Brak powiązanego użytkownika"));
            return;
        }
        log.info(userId.toString());
        String payload = message.getPayload();
        JsonNode node;
        try {
            node = objectMapper.readTree(payload);
        } catch (Exception e) {
            session.sendMessage(error("Nieprawidłowy format JSON"));
            return;
        }

        String command = node.has("command") ? node.get("command").asText().toLowerCase() : "";
        log.info("Command from user " + userId + ": " + command);

        try {
            switch (command) {
                case "join_table" -> handleJoinTable(userId, node, session);
                case "leave_table" -> handleLeaveTable(userId, node, session);
                case "start_hand" -> handleStartHand(userId, node, session);
                case "call" -> handleAction(userId, node, PlayerActionType.CALL);
                case "check" -> handleAction(userId, node, PlayerActionType.CHECK);
                case "fold" -> handleAction(userId, node, PlayerActionType.FOLD);
                case "bet" -> handleActionWithAmount(userId, node, PlayerActionType.BET);
                case "raise" -> handleActionWithAmount(userId, node, PlayerActionType.RAISE);
                case "all_in" -> handleAction(userId, node, PlayerActionType.ALL_IN);
                default -> session.sendMessage(error("Nieznany command: " + command));
            }
        } catch (Exception e) {
            log.severe("Error handling command: " + e.getMessage());
            session.sendMessage(error("Błąd serwera"));
        }
    }

    private void handleJoinTable(Long userId, JsonNode node, WebSocketSession session) throws IOException {
        int tableId = node.get("tableId").asInt();
        long buyIn = node.has("smallBlind") ? node.get("smallBlind").asLong() : 1000L;

        // tutaj możesz zrobić mapę tableId -> smallBlind, jeżeli stawka jest per stół
        // np. int smallBlind = switch (tableId) { case 1 -> 5; case 2 -> 10; case 3 -> 25; case 4 -> 50; default -> 5; };
        // i ustawiać ją w HoldemGameService / HoldemTable

        BalanceUpdateManager.BalanceUpdateResult result =
                balanceUpdateManager.sendBalanceUpdate(userId.intValue(), -buyIn);

        if (!result.isSuffFunds()) {
            session.sendMessage(error("Brak wystarczających środków"));
            return;
        }

        holdemGameService.joinTable(tableId, userId, buyIn);
        userCurrentTable.put(userId, tableId);

        // AUTO‑START: jeśli przy tym stole są już co najmniej 2 osoby, spróbuj od razu wystartować rozdanie
        tryAutoStartHand(tableId);

        sendTableStateToAll(tableId);
    }

    private void handleLeaveTable(Long userId, JsonNode node, WebSocketSession session) throws IOException {
        int tableId = node.get("tableId").asInt();

        HoldemTable table = holdemGameService.getTable(tableId);
        long stack = 0L;
        for (Seat seat : table.getSeats()) {
            if (userId.equals(seat.getUserId())) {
                stack = seat.getStack();
                break;
            }
        }

        if (stack > 0) {
            balanceUpdateManager.sendBalanceUpdate(userId.intValue(), stack);
        }

        holdemGameService.leaveTable(tableId, userId);
        userCurrentTable.remove(userId);

        sendTableStateToAll(tableId);
    }

    // zostawiamy, ale w normalnym flow nie będzie wołany z frontu
    private void handleStartHand(Long userId, JsonNode node, WebSocketSession session) throws IOException {
        int tableId = node.get("tableId").asInt();
        holdemGameService.startHandIfPossible(tableId);
        sendTableStateToAll(tableId);
//        restartActionTimer(tableId);
    }

    private void handleAction(Long userId, JsonNode node, PlayerActionType action) throws IOException {
        int tableId = node.get("tableId").asInt();
        holdemGameService.handlePlayerAction(tableId, userId, action, 0L);
        sendTableStateToAll(tableId);
//        restartActionTimer(tableId);
    }

    private void handleActionWithAmount(Long userId, JsonNode node, PlayerActionType action) throws IOException {
        int tableId = node.get("tableId").asInt();
        long amount = node.has("amount") ? node.get("amount").asLong() : 0L;
        holdemGameService.handlePlayerAction(tableId, userId, action, amount);
        sendTableStateToAll(tableId);
//        restartActionTimer(tableId);
    }

    private TextMessage error(String msg) {
        return new TextMessage("{\"type\":\"ERROR\",\"message\":\"" + msg + "\"}");
    }

    private void sendTableStateToAll(int tableId) throws IOException {
        HoldemTable table = holdemGameService.getTable(tableId);

        for (Seat seat : table.getSeats()) {
            if (!seat.isOccupied()) continue;
            Long userId = seat.getUserId();
            WebSocketSession s = userSessions.get(userId);
            if (s != null && s.isOpen()) {
                HoldemTableStateResponse response = HoldemTableStateResponse.from(table, userId);
                String json = objectMapper.writeValueAsString(response);
                s.sendMessage(new TextMessage(json));
            }
        }
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session,
                                      @NonNull CloseStatus status) {
        Long userId = sessionToUserMap.remove(session.getId());
        if (userId != null) {
            userSessions.remove(userId);
            Integer tableId = userCurrentTable.get(userId);
            if (tableId != null) {
                try {
                    holdemGameService.setSittingOut(tableId, userId, true);
                    sendTableStateToAll(tableId);
                } catch (Exception e) {
                    log.severe("Error setting sittingOut on disconnect: " + e.getMessage());
                }
            }
        }
        log.info("User disconnected from Hold'em");
    }

    private void restartActionTimer(int tableId) {
        Thread old = tableTimers.get(tableId);
        if (old != null && old.isAlive()) {
            old.interrupt();
        }

        Thread t = new Thread(() -> {
            try {
                Thread.sleep(ACTION_TIMEOUT_MS);
                HoldemTable table = holdemGameService.getTable(tableId);
                HoldemHand hand = table.getCurrentHand();
                if (hand == null) return;

                int seatPos = hand.getCurrentPlayerSeat();
                Seat seat = table.getSeats().stream()
                        .filter(s -> s.getPosition() == seatPos)
                        .findFirst()
                        .orElse(null);
                if (seat == null || seat.getUserId() == null) return;

                Long userId = seat.getUserId();
                holdemGameService.handlePlayerAction(tableId, userId, PlayerActionType.FOLD, 0L);
                sendTableStateToAll(tableId);
            } catch (InterruptedException ignored) {
            } catch (Exception e) {
                log.severe("Error in action timeout thread: " + e.getMessage());
            }
        });
        tableTimers.put(tableId, t);
        t.start();
    }

    /**
     * Auto‑start rozdania gdy są co najmniej 2 aktywni gracze i brak bieżącej ręki.
     */
    private void tryAutoStartHand(int tableId) {
        try {
            HoldemTable table = holdemGameService.getTable(tableId);
            if (table == null) return;

            long activePlayers = table.getSeats().stream()
                    .filter(Seat::isOccupied)
                    .count();

            if (activePlayers >= 2 && table.getCurrentHand() == null) {
                log.info("Auto‑starting hand at table " + tableId + " (players=" + activePlayers + ")");
                holdemGameService.startHandIfPossible(tableId);
//                restartActionTimer(tableId);
            }
        } catch (Exception e) {
            log.severe("Error in tryAutoStartHand: " + e.getMessage());
        }
    }
}
