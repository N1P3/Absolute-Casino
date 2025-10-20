import com.absoluteCasino.control.games.mummy.MummyGameSession;
import com.absoluteCasino.control.games.slot.SlotGameResultDTO;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class MummyVolatilityTest {
    private final long BET_AMOUNT = 10L;

    @Test
    void volatilityIndexTest() {
        MummyGameSession gameSession = new MummyGameSession("",1);
        List<Double> multipliers = new ArrayList<>();

        for (int i = 0; i < 1_000_000; i++) {
            SlotGameResultDTO result = gameSession.spin(BET_AMOUNT);
            multipliers.add(result.getMultiplier());
        }

        double mean = calculateMean(multipliers);
        double stdDev = calculateStandardDeviation(multipliers, mean);
        double volatilityIndex = (stdDev / mean) * 100;

        System.out.println("Volatility Index: " + volatilityIndex);
        assertTrue(volatilityIndex > 180 && volatilityIndex < 220,
                "Volatility index out of expected range");
    }

    private double calculateMean(List<Double> values) {
        return values.stream()
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0);
    }

    private double calculateStandardDeviation(List<Double> values, double mean) {
        double sumSquaredDiffs = values.stream()
                .mapToDouble(value -> Math.pow(value - mean, 2))
                .sum();
        return Math.sqrt(sumSquaredDiffs / values.size());
    }
}