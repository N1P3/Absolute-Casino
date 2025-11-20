package com.absoluteCasino.api;

import com.absoluteCasino.control.games.GameSession;
import com.absoluteCasino.control.games.GameSessionService;
import com.absoluteCasino.control.games.blackjack.BlackJackGameSession;
import com.absoluteCasino.user.UserDto;
import com.absoluteCasino.user.UserDtoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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
