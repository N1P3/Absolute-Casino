package com.absoluteCasino.config;


import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.File;

public class DatabaseConfig {
    static Logger logger = LoggerFactory.getLogger(DatabaseConfig.class);

    public static void determineDatabasePath() {
        String defaultPath = "./data/testdb";
        String dockerPath = "/data";

        File dockerVolume = new File(dockerPath);
        String finalPath = dockerVolume.exists() && dockerVolume.isDirectory() ? dockerPath + "/db" : defaultPath;

        logger.info("Database path is: " + finalPath);

        System.setProperty("DB_PATH", finalPath);
    }
}