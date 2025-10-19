package com.absoluteCasino.control.games.baccarat;

import com.absoluteCasino.control.user.BalanceUpdateManager;
import com.absoluteCasino.control.utils.JWTExtractor;
import com.absoluteCasino.security.JWTUtil;
import com.absoluteCasino.user.UserDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.HashMap;
import java.util.Map;

@Component
public class BaccaratWebSocketHandler extends TextWebSocketHandler {

    private final JWTUtil jwtUtil;
    private final BalanceUpdateManager balanceUpdateManager;

    @Autowired
    public BaccaratWebSocketHandler(JWTUtil jwtUtil, BalanceUpdateManager balanceUpdateManager) {
        this.jwtUtil = jwtUtil;
        this.balanceUpdateManager = balanceUpdateManager;
    }

    private final Map<String, BaccaratGameSession> sessions = new HashMap<>();

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

            BaccaratGameSession gameSession = new BaccaratGameSession(user.getId());

            session.sendMessage(new TextMessage("{\"Type\":\"CONNECTED\"}"));

            sessions.put(session.getId(), gameSession);
        } catch (Exception e) {

            session.close();
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        BaccaratGameSession gameSession = sessions.get(session.getId());
        if (gameSession == null) {
            session.sendMessage(new TextMessage("{\"Type\":\"ERROR\",\"Message\":\"Brak sesji\"}"));
            return;
        }

        ObjectMapper objectMapper = new ObjectMapper();
        JsonNode commandNode;
        try {
            commandNode = objectMapper.readTree(payload);
        } catch (Exception e) {
            session.sendMessage(new TextMessage("{\"Type\":\"ERROR\",\"Message\":\"Brak wiadomości o takim typie\"}"));
            return;
        }

        String command = commandNode.get("command").asText().toLowerCase();
        String response;
        boolean wrongCommand = false;
        BaccaratGameResponse baccaratGameResponse;
        BalanceUpdateManager.BalanceUpdateResult sufficientFunds;
        if (command.equalsIgnoreCase("deal")) {
            if (commandNode.has("bet")) {
                long bet = commandNode.get("bet").asLong();
                sufficientFunds = balanceUpdateManager.sendBalanceUpdate(gameSession.getUserId(), bet * -1);
                if (!sufficientFunds.isSuffFunds()) {
                    session.sendMessage(new TextMessage("{\"Type\":\"ERROR\",\"Message\":\"Brak kasy\"}"));
                    return;
                }
                var choice = BaccaratPlayersChoice.valueOf(commandNode.get("choice").asText().toUpperCase());
                baccaratGameResponse = gameSession.dealCards(choice, bet);
                response = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(baccaratGameResponse);
            } else {
                session.sendMessage(new TextMessage("{\"Type\":\"ERROR\",\"Message\":\"Dzie bet\"}"));
                return;
            }
        } else {
            session.sendMessage(new TextMessage("{\"Type\":\"ERROR\",\"Message\":\"Zły komend\"}"));
            return;
        }
        if (!wrongCommand) {
            if (baccaratGameResponse.playersResult== BaccaratGameResult.WIN) {
                balanceUpdateManager.sendBalanceUpdate(gameSession.getUserId(), baccaratGameResponse.moneyWon);
            }
        }

        session.sendMessage(new TextMessage(response));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
    }
}

