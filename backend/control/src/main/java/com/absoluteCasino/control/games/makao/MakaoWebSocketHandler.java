package com.absoluteCasino.control.games.makao;

import com.absoluteCasino.control.user.BalanceUpdateManager;
import com.absoluteCasino.control.utils.JWTExtractor;
import com.absoluteCasino.security.JWTUtil;
import com.absoluteCasino.user.UserDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Log
@Component
public class MakaoWebSocketHandler extends TextWebSocketHandler {

    private final JWTUtil jwtUtil;
    private final BalanceUpdateManager balanceUpdateManager;

    @Autowired
    public MakaoWebSocketHandler(JWTUtil jwtUtil, BalanceUpdateManager balanceUpdateManager) {
        this.jwtUtil = jwtUtil;
        this.balanceUpdateManager = balanceUpdateManager;
    }

    private final Map<String, MakaoGameSession> gameSessions = new ConcurrentHashMap<>();

    private final Map<String, MakaoGameRoom> gameRooms = new ConcurrentHashMap<>();

    private final Map<Integer, WebSocketSession> userSessions = new ConcurrentHashMap<>();

    private final Map<String, Integer> sessionToUserMap = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
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

            MakaoGameSession gameSession = new MakaoGameSession(session.getId(), user.getId());
            gameSessions.put(session.getId(), gameSession);
            userSessions.put(user.getId(), session);
            sessionToUserMap.put(session.getId(), user.getId());

            session.sendMessage(new TextMessage("{\"type\":\"CONNECTED\"}"));
            log.info("User " + user.getId() + " connected to Makao");

        } catch (Exception e) {
            log.severe("Error in afterConnectionEstablished: " + e.getMessage());
            session.close();
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        MakaoGameSession gameSession = gameSessions.get(session.getId());

        if (gameSession == null) {
            session.sendMessage(new TextMessage("{\"Type\":\"ERROR\",\"Message\":\"Brak sesji gry\"}"));
            return;
        }

        ObjectMapper objectMapper = new ObjectMapper();
        JsonNode commandNode;
        try {
            commandNode = objectMapper.readTree(payload);
        } catch (Exception e) {
            session.sendMessage(new TextMessage("{\"Type\":\"ERROR\",\"Message\":\"Nieprawidłowy format JSON\"}"));
            return;
        }

        String command = commandNode.get("command").asText().toLowerCase();
        String response = null;
        boolean shouldBroadcast = false;

        try {
            switch (command) {
                case "join_room":
                    response = handleJoinRoom(gameSession, commandNode, objectMapper);
                    break;

                case "start_game":
                    response = handleStartGame(gameSession, objectMapper);
                    // Check for errors
                    if (response.contains("\"Type\":\"ERROR\"")) {
                        // Error case - send directly to the player
                    } else {
                        // Success - broadcast to all players instead of sending individual response
                        response = null;
                        shouldBroadcast = true;
                    }
                    break;

                case "play_card":
                    response = handlePlayCard(gameSession, commandNode, objectMapper);
                    // Only send error responses directly, otherwise broadcast to all players
                    if (response.contains("\"Type\":\"ERROR\"")) {
                        // Error case - send directly to the player
                    } else {
                        // Success - will broadcast instead to avoid duplicate messages
                        response = null;
                        shouldBroadcast = true;
                    }
                    break;

                case "draw_card":
                    response = handleDrawCard(gameSession, objectMapper);
                    // Only send error responses directly, otherwise broadcast to all players
                    if (response.contains("\"Type\":\"ERROR\"")) {
                        // Error case - send directly to the player
                    } else {
                        // Success - will broadcast instead to avoid duplicate messages
                        response = null;
                        shouldBroadcast = true;
                    }
                    break;

                case "skip_turn":
                    response = handleSkipTurn(gameSession, objectMapper);
                    if (response.contains("\"Type\":\"ERROR\"")) {
                    } else {
                        response = null;
                        shouldBroadcast = true;
                    }
                    break;

                case "leave_game":
                    response = handleLeaveGame(gameSession, objectMapper);
                    break;

                default:
                    response = "{\"Type\":\"ERROR\",\"Message\":\"Nieznany komend\"}";
            }

            if (response != null) {
                session.sendMessage(new TextMessage(response));
            }

            if (shouldBroadcast && gameSession.getGameRoom() != null && gameSession.getGameRoom().isGameActive()) {
                broadcastGameState(gameSession.getGameRoom());
            }

        } catch (Exception e) {
            log.severe("Error handling command: " + e.getMessage());
            e.printStackTrace();
            session.sendMessage(new TextMessage("{\"Type\":\"ERROR\",\"Message\":\"Błąd serwera: " + e.getMessage() + "\"}"));
        }
    }

    private String handleJoinRoom(MakaoGameSession gameSession, JsonNode commandNode, ObjectMapper objectMapper) throws Exception {
        Integer userId = gameSession.getUserId();
        long bet = commandNode.has("bet") ? commandNode.get("bet").asLong() : 10L;

        BalanceUpdateManager.BalanceUpdateResult sufficientFunds = balanceUpdateManager.sendBalanceUpdate(userId, bet * -1);
        if (!sufficientFunds.isSuffFunds()) {
            return "{\"Type\":\"ERROR\",\"Message\":\"Brak wystarczających środków\"}";
        }

        MakaoGameRoom room = findOrCreateRoom(userId);
        gameSession.setGameRoom(room);

        MakaoPlayer player = new MakaoPlayer(userId, "Player" + userId);
        player.setBet(bet);

        if (room.addPlayer(userId, "Player" + userId)) {
            MakaoGameResponse response = new MakaoGameResponse();
            response.setType("JOINED_ROOM");
            response.setMessage("Dołączyłeś do pokoju. Oczekiwanie na drugiego gracza...");

            if (room.isFull()) {
                response.setMessage("Pokój pełny! Gra zaczyna się...");

                for (MakaoPlayer p : room.getPlayers()) {
                    MakaoGameSession pSession = findGameSessionByUserId(p.getUserId());
                    if (pSession != null && pSession.getGameRoom() == null) {
                        pSession.setGameRoom(room);
                        log.info("Linked player " + p.getUserId() + " session to room " + room.getRoomId());
                    }
                }

                broadcastToRoom(room, response, objectMapper);
            }


            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(response);
        } else {
            return "{\"Type\":\"ERROR\",\"Message\":\"Nie można dołączyć do pokoju\"}";
        }
    }

    private String handleStartGame(MakaoGameSession gameSession, ObjectMapper objectMapper) throws Exception {
        if (gameSession.getGameRoom() == null || !gameSession.getGameRoom().isFull()) {
            return "{\"Type\":\"ERROR\",\"Message\":\"Pokój nie jest pełny\"}";
        }

        MakaoGameRoom room = gameSession.getGameRoom();

        room.initializeDeck();

        for (MakaoPlayer player : room.getPlayers()) {
            player.clearHand();
            for (int i = 0; i < 5; i++) {
                player.addCard(room.drawCard());
            }
        }

        String tableCard = room.drawCard();
        room.getGame().setTableCard(tableCard);

        room.setGameActive(true);
        room.setCurrentPlayerIndex(0);

        return "{\"type\":\"GAME_STARTED\",\"message\":\"Gra rozpoczęta\"}";
    }

    private String handlePlayCard(MakaoGameSession gameSession, JsonNode commandNode, ObjectMapper objectMapper) throws Exception {
        int cardIndex = commandNode.get("card_index").asInt();
        String chosenSuit = commandNode.has("chosen_suit") ? commandNode.get("chosen_suit").asText() : null;
        String chosenNumber = commandNode.has("chosen_number") ? commandNode.get("chosen_number").asText() : null; // for Jack
        String chosenValue = commandNode.has("chosen_value") ? commandNode.get("chosen_value").asText() : null;   // for Joker mimic
        MakaoGameResponse response = gameSession.playCard(gameSession.getUserId(), cardIndex, chosenSuit, chosenNumber, chosenValue);
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(response);
    }

    private String handleDrawCard(MakaoGameSession gameSession, ObjectMapper objectMapper) throws Exception {
        MakaoGameResponse response = gameSession.drawCard(gameSession.getUserId());

        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(response);
    }

    private String handleSkipTurn(MakaoGameSession gameSession, ObjectMapper objectMapper) throws Exception {
        MakaoGameResponse response = gameSession.skipTurn(gameSession.getUserId());
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(response);
    }

    private String handleLeaveGame(MakaoGameSession gameSession, ObjectMapper objectMapper) throws Exception {
        if (gameSession.getGameRoom() != null) {
            gameSession.getGameRoom().removePlayer(gameSession.getUserId());

            if (gameSession.getGameRoom().isEmpty()) {
                gameRooms.remove(gameSession.getGameRoom().getRoomId());
            }
        }

        MakaoGameResponse response = new MakaoGameResponse();
        response.setType("LEFT_GAME");
        response.setMessage("Opuściłeś grę");

        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(response);
    }

    private MakaoGameRoom findOrCreateRoom(Integer userId) {
        for (MakaoGameRoom room : gameRooms.values()) {
            if (!room.isFull() && !room.isGameActive()) {
                return room;
            }
        }

        String roomId = "room_" + UUID.randomUUID().toString();
        MakaoGameRoom newRoom = new MakaoGameRoom(roomId);
        gameRooms.put(roomId, newRoom);

        return newRoom;
    }

    private void broadcastGameState(MakaoGameRoom room) throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();

        log.info("Broadcasting game state to " + room.getPlayers().size() + " players");

        for (MakaoPlayer player : room.getPlayers()) {
            WebSocketSession playerSession = userSessions.get(player.getUserId());
            if (playerSession != null && playerSession.isOpen()) {
                MakaoGameSession session = findGameSessionByUserId(player.getUserId());
                if (session != null) {
                    MakaoGameResponse playerResponse = createPlayerResponse(session, room);
                    String jsonResponse = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(playerResponse);
                    log.info("Sending to player " + player.getUserId() + ": " + jsonResponse);
                    playerSession.sendMessage(new TextMessage(jsonResponse));
                }
            } else {
                log.warning("Player session not found or closed for user " + player.getUserId());
            }
        }
    }

    private void broadcastToRoom(MakaoGameRoom room, MakaoGameResponse response, ObjectMapper objectMapper) throws Exception {
        for (MakaoPlayer player : room.getPlayers()) {
            WebSocketSession playerSession = userSessions.get(player.getUserId());
            if (playerSession != null && playerSession.isOpen()) {
                playerSession.sendMessage(new TextMessage(
                        objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(response)
                ));
            }
        }
    }

    private MakaoGameResponse createPlayerResponse(MakaoGameSession session, MakaoGameRoom room) {
        MakaoGameResponse response = new MakaoGameResponse();
        response.setType("GAME_STATE");

        MakaoPlayer thisPlayer = room.getPlayerByUserId(session.getUserId());
        MakaoPlayer opponent = room.getPlayers().stream()
                .filter(p -> !p.getUserId().equals(session.getUserId()))
                .findFirst()
                .orElse(null);

        if (thisPlayer != null) {
            response.setPlayerHand(thisPlayer.getHand());
            response.setTableCard(room.getGame().getTableCard());
            response.setCurrentSuit(room.getGame().getCurrentSuit());
            response.setRequiredNumber(room.getGame().getRequiredNumber());
            response.setPendingDrawCount(room.getGame().getPendingDrawCount());
            response.setDrawType(room.getGame().getDrawType());
            response.setPendingSkipTurns(room.getGame().getPendingSkipTurns());
            response.setPlayerToSkip(room.getGame().getPlayerToSkip());
            response.setOpponentHandCount(opponent != null ? opponent.getHandSize() : 0);

            MakaoPlayer currentPlayer = room.getCurrentPlayer();
            response.setCurrentPlayerId(currentPlayer.getUserId());
            response.setCurrentPlayerName(currentPlayer.getUserName());

            response.setPlayers(room.getPlayers().stream()
                    .map(p -> new MakaoGameResponse.MakaoPlayerInfo(
                            p.getUserId(),
                            p.getUserName(),
                            p.getHandSize(),
                            p.getUserId().equals(currentPlayer.getUserId())
                    ))
                    .toList());

            if (room.isGameOver()) {
                MakaoPlayer winner = room.getWinner();
                response.setGameOver(true);
                response.setResult(winner != null && winner.getUserId().equals(session.getUserId()) ? "WIN" : "LOSE");
            }
        }

        return response;
    }

    private MakaoGameSession findGameSessionByUserId(Integer userId) {
        return gameSessions.values().stream()
                .filter(s -> s.getUserId().equals(userId))
                .findFirst()
                .orElse(null);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Integer userId = sessionToUserMap.remove(session.getId());
        MakaoGameSession gameSession = gameSessions.remove(session.getId());

        if (userId != null) {
            userSessions.remove(userId);
        }

        if (gameSession != null && gameSession.getGameRoom() != null) {
            gameSession.getGameRoom().removePlayer(gameSession.getUserId());

            if (gameSession.getGameRoom().isEmpty()) {
                gameRooms.remove(gameSession.getGameRoom().getRoomId());
            }
        }

        log.info("User disconnected from Makao");
    }
}

