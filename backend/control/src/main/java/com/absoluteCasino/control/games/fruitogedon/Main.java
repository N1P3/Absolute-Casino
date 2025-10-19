package com.absoluteCasino.control.games.fruitogedon;

import com.absoluteCasino.control.games.slot.SlotGameLogic;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

public class Main {
    public static void main(String[] args) throws JsonProcessingException {
        FruitsGameSession gameSession = new FruitsGameSession(135);

        for (int i = 0; i < 100; i++) {
            gameSession.spin(1L);
        }


    }
}
