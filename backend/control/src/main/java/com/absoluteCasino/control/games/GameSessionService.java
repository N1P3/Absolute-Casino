package com.absoluteCasino.control.games;

import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class GameSessionService {
    private final Map<Integer, List<GameSession>> userSessions = new HashMap<>();

    public void addGameSession(Integer userId, GameSession session) {
        userSessions.putIfAbsent(userId, new ArrayList<>());
        userSessions.get(userId).add(session);
    }

    public List<GameSession> getGameSessions(Integer userId) {
        return userSessions.getOrDefault(userId, new ArrayList<>());
    }

    public Map<Integer, List<GameSession>> getAllSessions() {
        return userSessions;
    }

    public void removeSessions(Integer userId) {
        userSessions.remove(userId);
    }
}
