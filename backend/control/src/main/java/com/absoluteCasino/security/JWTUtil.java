package com.absoluteCasino.security;

import com.absoluteCasino.user.UserDto;
import com.absoluteCasino.user.UserDtoRepository;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTDecodeException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Date;

@Service
public class JWTUtil {

    @Autowired
    UserDtoRepository userDtoRepository;

    private final String SECRET_KEY = "mySuperSecretKey1234567890";
    private final Algorithm algorithm = Algorithm.HMAC256(SECRET_KEY);

    public String generateToken(UserDetails userDetails) {
        return JWT.create()
                .withSubject(userDetails.getUsername())
                .withIssuedAt(new Date())
                .withExpiresAt(new Date(System.currentTimeMillis() + 1000 * 60 * 60))
                .sign(algorithm);
    }

    public boolean validateToken(String token, UserDetails userDetails) {
        DecodedJWT decodedJWT = decodeJWT(token);
        String username = decodedJWT.getSubject();
        return (username.equals(userDetails.getUsername()) && !isTokenExpired(decodedJWT));
    }

    private DecodedJWT decodeJWT(String token) {
        JWTVerifier verifier = JWT.require(algorithm).build();
        return verifier.verify(token);
    }

    private boolean isTokenExpired(DecodedJWT decodedJWT) {
        return decodedJWT.getExpiresAt().before(new Date());
    }

    public String extractUsername(String token) {
        try {
            DecodedJWT decodedJWT = JWT.decode(token);
            return decodedJWT.getSubject();
        } catch (JWTDecodeException e) {
            throw new RuntimeException("Nieprawidłowy token JWT", e);
        }
    }

    public UserDto extractUser(String token) {
        try {
            return userDtoRepository.findByLogin(extractUsername(token)).get();
        }catch (Exception e) {
            return null;
        }
    }

    public void removeJwtCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie("jwt", null);
        cookie.setMaxAge(0);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        response.addCookie(cookie);
    }

}
