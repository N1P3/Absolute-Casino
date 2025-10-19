package com.absoluteCasino.control.utils;

import org.springframework.web.socket.WebSocketSession;

import java.util.List;

public class JWTExtractor {

    public static String extractJwtFromSession(WebSocketSession session) {
        List<String> cookies = session.getHandshakeHeaders().get("Cookie");
        if (cookies != null) {
            for (String cookie : cookies) {
                if (cookie.startsWith("jwt=")) {
                    return cookie.substring(4);
                }
            }
        }
        return null;
    }

}
