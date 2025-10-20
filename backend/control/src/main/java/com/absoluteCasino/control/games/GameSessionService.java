package com.absoluteCasino.control.games;

import com.absoluteCasino.control.games.poker.PokerGameSession;
import com.absoluteCasino.games.user.User;
import com.absoluteCasino.user.UserDto;
import lombok.Getter;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@Getter
public class GameSessionService {
    private final Map<Integer, List<GameSession>> userSessions = new HashMap<>();
    private final Map<PokerGameSession, List<UserDto>> pokerSessions = new HashMap<>();

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
