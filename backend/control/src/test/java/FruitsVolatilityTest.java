import com.absoluteCasino.control.games.fruitogedon.FruitsGameSession;
import com.absoluteCasino.control.games.slot.SlotGameResultDTO;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class FruitsVolatilityTest {
    private final long BET_AMOUNT = 10L;

//    @Test
//    void fruitsVolatilityIndexTest() {
//        FruitsGameSession gameSession = new FruitsGameSession("",1);
//        List<Double> multipliers = new ArrayList<>();
//
//        for (int i = 0; i < 1_000_000; i++) {
//            SlotGameResultDTO result = gameSession.spin(BET_AMOUNT);
//            multipliers.add(result.getMultiplier());
//        }
//
//        double mean = calculateMean(multipliers);
//        double stdDev = calculateStandardDeviation(multipliers, mean);
//        double volatilityIndex = (stdDev / mean) * 100;
//
//        System.out.println("Średnia wygrana: " + mean);
//        System.out.println("Odchylenie standardowe: " + stdDev);
//        System.out.println("Wskaźnik zmienności: " + volatilityIndex + "%");
//
//        assertTrue(volatilityIndex > 160 && volatilityIndex*0.5 < 200,
//                "Wskaźnik zmienności poza oczekiwanym zakresem");
//    }

    private double calculateMean(List<Double> values) {
        return values.stream()
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0);
    }

    private double calculateStandardDeviation(List<Double> values, double mean) {
        double variance = values.stream()
                .mapToDouble(value -> Math.pow(value - mean, 2))
                .average()
                .orElse(0.0);
        return Math.sqrt(variance);
    }
}