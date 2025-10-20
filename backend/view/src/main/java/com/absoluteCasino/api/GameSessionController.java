package com.absoluteCasino.api;

import com.absoluteCasino.control.games.blackjack.BlackJackGameSession;
import com.absoluteCasino.control.games.GameSession;
import com.absoluteCasino.control.games.GameSessionService;
import com.absoluteCasino.control.games.poker.PokerGame;
import com.absoluteCasino.control.games.poker.PokerGameSession;
import com.absoluteCasino.user.UserDto;
import com.absoluteCasino.user.UserDtoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.rmi.server.UID;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/sessions")
public class GameSessionController {

    @Autowired
    private GameSessionService gameSessionService;
    @Autowired
    UserDtoRepository userDtoRepository;

    @PostMapping("/blackjack")
    public BlackJackGameSession startBlackjackSession(Authentication authentication) {
        String login = authentication.getName();
        UserDto user;
        try {
            user = userDtoRepository.findByLogin(login).get();
        } catch (Exception e) {
            return null;
        }
// nie pamiętam czy to było w ogóle używane
//        BlackJackGameSession session = new BlackJackGameSession(user.getId());
//        gameSessionService.addGameSession(user.getId(), session);
//        return session;
        return null;
    }

    @GetMapping("/poker")
    public PokerGameSession startPokerSession(Authentication authentication) {
        String login = authentication.getName();
        UserDto user;
        try {
            user = userDtoRepository.findByLogin(login).get();
        } catch (Exception e) {
            return null;
        }
        if (gameSessionService.getGameSessions(user.getId()).stream().anyMatch(gameSession -> gameSession instanceof PokerGameSession)) {
            return null;
        }
        PokerGameSession session = null;
        for (PokerGameSession gameSession : gameSessionService.getPokerSessions().keySet()) {
            if (gameSessionService.getPokerSessions().get(gameSession).size() < 6) {
                session = gameSession;
            }
        }
        if (session == null) {
            session = new PokerGameSession(new UID().toString(), user.getId());
            gameSessionService.getPokerSessions().keySet().add(session);
        }
        gameSessionService.addGameSession(user.getId(), session);
        gameSessionService.getPokerSessions().get(session).add(user);
        return session;
    }

    @GetMapping("/user")
    public List<GameSession> getUserSessions(Authentication authentication) {
        String login = authentication.getName();
        UserDto user;
        try {
            user = userDtoRepository.findByLogin(login).get();
        } catch (Exception e) {
            return new ArrayList<>();
        }
        return gameSessionService.getGameSessions(user.getId());
    }

    @GetMapping
    public Map<Integer, List<GameSession>> getAllSessions() {
        return gameSessionService.getUserSessions();
    }

    @DeleteMapping("/delete")
    public void removeUserSessions(Authentication authentication) {
        String login = authentication.getName();
        UserDto user;
        try {
            user = userDtoRepository.findByLogin(login).get();
        } catch (Exception e) {
            return;
        }
        gameSessionService.removeSessions(user.getId());
    }
}
