package com.absoluteCasino.config;

import com.absoluteCasino.security.JWTUtil;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.List;
import java.util.Map;

public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private final JWTUtil jwtUtil;

    public JwtHandshakeInterceptor(JWTUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {

        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpServletRequest httpServletRequest = servletRequest.getServletRequest();
            Cookie[] cookies = httpServletRequest.getCookies();
            if (cookies != null) {
                for (Cookie c : cookies) {
                    if ("jwt".equals(c.getName())) {
                        String token = c.getValue();
                        try {
                            String username = jwtUtil.extractUsername(token);
                            if (username != null) {
                                attributes.put("username", username);
                                return true;
                            }
                        } catch (Exception e) {
                            return false;
                        }
                    }
                }
            }
        }
        return false;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
    }
}
