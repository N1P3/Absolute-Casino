package com.absoluteCasino.control.user;

import com.absoluteCasino.user.UserDto;
import com.absoluteCasino.user.UserDtoRepository;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class BalanceUpdateManager {

    @Autowired
    UserDtoRepository userRepository;

    private static final Map<Integer, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public static void addSession(Integer userId, WebSocketSession session) {
        sessions.put(userId, session);
    }

    public static void removeSession(Integer userId) {
        sessions.remove(userId);
    }

    public BalanceUpdateResult sendBalanceUpdate(Integer userId, long balanceChange) {
        long newBalance = 0L;
        try {
            UserDto userDto = userRepository.findById(userId).get();
            newBalance = userDto.getBalance() + balanceChange;
            if (newBalance < 0L) {
                return new BalanceUpdateResult(false, false);
            }
            userDto.setBalance(newBalance);
            userRepository.save(userDto);
        } catch (Exception e) {
            sessions.remove(userId);
            return new BalanceUpdateResult(false, false);
        }

        WebSocketSession session = sessions.get(userId);
        if (session != null && session.isOpen()) {
            try {
                String message = "{\"Type\":\"BALANCE_UPDATE\",\"Balance\":\"" + newBalance + "\"}";
                session.sendMessage(new TextMessage(message));
            } catch (IOException e) {
                sessions.remove(userId);
                return new BalanceUpdateResult(false, false);
            }
        }
        if (newBalance >= balanceChange * -1) {
            return new BalanceUpdateResult(true, true);
        } else {
            return new BalanceUpdateResult(true, false);
        }
    }

    @Getter
    @Setter
    @AllArgsConstructor
    public static class BalanceUpdateResult {
        boolean suffFunds;
        boolean suffDoubleFunds;
    }

}
