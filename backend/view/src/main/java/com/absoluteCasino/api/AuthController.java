package com.absoluteCasino.api;

import com.absoluteCasino.security.JWTUtil;
import com.absoluteCasino.user.UserService;
import lombok.Getter;
import lombok.Setter;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserService userDetailsService;
    private final JWTUtil jwtUtil;

    public AuthController(AuthenticationManager authenticationManager, UserService userDetailsService, JWTUtil jwtUtil) {
        this.authenticationManager = authenticationManager;
        this.userDetailsService = userDetailsService;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/authenticate")
    public ResponseEntity<?> createAuthenticationToken(@RequestBody AuthRequest authRequest) throws Exception {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(authRequest.getLogin(), authRequest.getPassword())
            );
        } catch (AuthenticationException e) {
            System.out.println("Błąd logowania: " + e.getMessage());
            throw new Exception("Niewłaściwe dane uwierzytelniające", e);
        }

        final UserDetails userDetails = userDetailsService.loadUserByUsername(authRequest.getLogin());
        final String jwt = jwtUtil.generateToken(userDetails);

        ResponseCookie jwtCookie = ResponseCookie.from("jwt", jwt)
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(24 * 60 * 60)
                .sameSite("Strict")
                .build();

        return ResponseEntity.ok()
                .header("Set-Cookie", jwtCookie.toString())
                .body(Map.of("username", userDetails.getUsername(), "role", userDetails.getAuthorities()));
    }

    @GetMapping("/logout")
    public ResponseEntity<?> logoutUser(Authentication authentication) throws Exception {
        ResponseCookie jwtCookie = ResponseCookie.from("jwt", "blank")
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(1)
                .sameSite("Strict")
                .build();

        return ResponseEntity.ok().header("Set-Cookie", jwtCookie.toString()).build();
    }
}

@Getter
@Setter
class AuthRequest {
    private String login;
    private String password;
}
