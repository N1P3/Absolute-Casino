package com.absoluteCasino;

import com.absoluteCasino.config.DatabaseConfig;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {

    public static void main(String[] args) {
        DatabaseConfig.determineDatabasePath();

        SpringApplication.run(Application.class, args);
    }

}