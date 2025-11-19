package com.absoluteCasino.control.games;

import lombok.Getter;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Getter
public class GameSessionService {
    private final Map<Integer, List<GameSession>> userSessions = new HashMap<>();

    public void addGameSession(Integer userId, GameSession session) {
        userSessions.putIfAbsent(userId, new ArrayList<>());
        userSessions.get(userId).add(session);
    }

    public List<GameSession> getGameSessions(Integer userId) {
        return userSessions.getOrDefault(userId, new ArrayList<>());
    }

    public void removeSessions(Integer userId) {
        userSessions.remove(userId);
    }
}
