package com.absoluteCasino.config;

import com.absoluteCasino.control.games.baccarat.BaccaratWebSocketHandler;
import com.absoluteCasino.control.games.blackjack.BlackJackWebSocketHandler;
import com.absoluteCasino.control.games.fruitogedon.FruitsWebSocketHandler;
import com.absoluteCasino.control.games.makao.MakaoWebSocketHandler;
import com.absoluteCasino.control.games.mummy.MummyWebSocketHandler;
import com.absoluteCasino.control.user.UserBalanceWebSocketHandler;
import com.absoluteCasino.security.JWTUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final BlackJackWebSocketHandler blackJackWebSocketHandler;
    private final UserBalanceWebSocketHandler userBalanceWebSocketHandler;
    private final MummyWebSocketHandler mummyWebSocketHandler;
    private final BaccaratWebSocketHandler baccaratWebSocketHandler;
    private final FruitsWebSocketHandler fruitsWebSocketHandler;
    private final MakaoWebSocketHandler makaoWebSocketHandler;
    private final JWTUtil jwtUtil;

    @Autowired
    public WebSocketConfig(BlackJackWebSocketHandler blackJackWebSocketHandler,
                           UserBalanceWebSocketHandler userBalanceWebSocketHandler,
                           MummyWebSocketHandler mummyWebSocketHandler,
                           FruitsWebSocketHandler fruitsWebSocketHandler,
                           BaccaratWebSocketHandler baccaratWebSocketHandler,
                           MakaoWebSocketHandler makaoWebSocketHandler,
                           JWTUtil jwtUtil) {
        this.blackJackWebSocketHandler = blackJackWebSocketHandler;
        this.userBalanceWebSocketHandler = userBalanceWebSocketHandler;
        this.mummyWebSocketHandler = mummyWebSocketHandler;
        this.fruitsWebSocketHandler = fruitsWebSocketHandler;
        this.baccaratWebSocketHandler = baccaratWebSocketHandler;
        this.makaoWebSocketHandler = makaoWebSocketHandler;
        this.jwtUtil = jwtUtil;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(blackJackWebSocketHandler, "/ws/blackjack")
                .addInterceptors(new JwtHandshakeInterceptor(jwtUtil))
                .setAllowedOriginPatterns("*");

        registry.addHandler(userBalanceWebSocketHandler, "/ws/balance")
                .addInterceptors(new JwtHandshakeInterceptor(jwtUtil))
                .setAllowedOriginPatterns("*");

        registry.addHandler(mummyWebSocketHandler, "/ws/mummy")
                .addInterceptors(new JwtHandshakeInterceptor(jwtUtil))
                .setAllowedOriginPatterns("*");

        registry.addHandler(fruitsWebSocketHandler, "/ws/fruits")
                .addInterceptors(new JwtHandshakeInterceptor(jwtUtil))
                .setAllowedOriginPatterns("*");

        registry.addHandler(baccaratWebSocketHandler, "/ws/baccarat")
                .addInterceptors(new JwtHandshakeInterceptor(jwtUtil))
                .setAllowedOriginPatterns("*");

        registry.addHandler(makaoWebSocketHandler, "/ws/makao")
                .addInterceptors(new JwtHandshakeInterceptor(jwtUtil))
                .setAllowedOriginPatterns("*");
    }
}

