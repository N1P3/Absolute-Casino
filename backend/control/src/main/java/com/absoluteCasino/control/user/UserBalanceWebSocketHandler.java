package com.absoluteCasino.control.user;

import com.absoluteCasino.security.JWTUtil;
import com.absoluteCasino.user.UserDto;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class UserBalanceWebSocketHandler extends TextWebSocketHandler {

    private final JWTUtil jwtUtil;

    @Autowired
    public UserBalanceWebSocketHandler(JWTUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String token = extractJwtFromSession(session);
        if (token == null || token.isEmpty()) {
            session.close();
            return;
        }

        UserDto user = jwtUtil.extractUser(token);
        if (user == null) {
            session.close();
            return;
        }

        BalanceUpdateManager.addSession(user.getId(), session);
        session.sendMessage(new TextMessage("{\"Type\":\"CONNECTED\",\"Balance\":\"" + user.getBalance() + "\"}"));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Integer userId = getUserIdFromSession(session);
        if (userId != null) {
            BalanceUpdateManager.removeSession(userId);
        }
    }

    private Integer getUserIdFromSession(WebSocketSession session) {
        String token = extractJwtFromSession(session);
        try {
            if (token == null || token.isEmpty()) {
                session.close();
                return null;
            }
            UserDto user = jwtUtil.extractUser(token);
            if (user == null) {
                session.close();
                return null;
            } else {
                return user.getId();
            }
        } catch (Exception ignored) {}
        return null;
    }

    private String extractJwtFromSession(WebSocketSession session) {
        return session.getHandshakeHeaders().get("Cookie").stream()
                .filter(cookie -> cookie.startsWith("jwt="))
                .map(cookie -> cookie.substring(4))
                .findFirst()
                .orElse(null);
    }
}
