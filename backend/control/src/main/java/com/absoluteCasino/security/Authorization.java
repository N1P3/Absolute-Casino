package com.absoluteCasino.security;

public class Authorization {
    private String login;
    private String token;

    public Authorization(String login, String token) {
        this.login = login;
        this.token = token;
    }
}
