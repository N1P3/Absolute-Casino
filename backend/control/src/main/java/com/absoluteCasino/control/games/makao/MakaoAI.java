package com.absoluteCasino.control.games.makao;

import ai.onnxruntime.*;
import java.io.InputStream;
import java.util.*;
import java.nio.FloatBuffer;

/**
 * Makao AI z obsługą multi-card (93 akcje).
 * 
 * Przestrzeń akcji:
 *   0-51:  Single card play (rank*4 + suit)
 *   52-64: 2x card play (rank index 0-12)
 *   65-77: 3x card play (rank index 0-12)
 *   78-90: 4x card play (rank index 0-12)
 *   91:    Draw
 *   92:    Skip
 * 
 * Przestrzeń obserwacji (180 floatów):
 *   0-51:   Moja ręka (one-hot)
 *   52-103: Karta na stole (one-hot)
 *   104-155: Karty które wyszły (counter)
 *   156:    Pending draw
 *   157:    Pending skip
 *   158-161: Required suit
 *   162-174: Required rank
 *   175:    Opponent hand size
 *   176:    Deck size
 *   177:    My hand size
 *   178:    Card difference
 *   179:    Close to win flag
 */
public class MakaoAI {
    private static final int OBS_SIZE = 180;
    private static final int ACTION_SIZE = 93;
    
    private OrtEnvironment env;
    private OrtSession session;
    private final List<String> cardMap;
    private final List<String> suits = List.of("H", "D", "C", "S");
    private final List<String> ranks = List.of("2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A");
    
    // Track discarded cards for observation
    private List<String> discardPile = new ArrayList<>();

    public static class AIAction {
        public String type; // "PLAY", "DRAW", "SKIP"
        public List<String> cards; // Lista kart do zagrania (1-4)
        public String chosenSuit;
        public String chosenNumber;
        
        public AIAction() {
            cards = new ArrayList<>();
        }
        
        // Backwards compatibility
        public String getCard() {
            return cards.isEmpty() ? null : cards.get(0);
        }
    }

    public MakaoAI() {
        cardMap = new ArrayList<>();
        for (String r : ranks) {
            for (String s : suits) {
                cardMap.add(r + s);
            }
        }

        try {
            env = OrtEnvironment.getEnvironment();
            InputStream modelStream = getClass().getResourceAsStream("/onnx/makao_model.onnx");
            if (modelStream == null) {
                System.err.println("CRITICAL ERROR: ONNX model not found at /onnx/makao_model.onnx");
                System.err.println("Please ensure 'makao_model.onnx' is in 'src/main/resources/onnx/' and project is rebuilt.");
                return;
            }
            byte[] modelBytes = modelStream.readAllBytes();
            session = env.createSession(modelBytes, new OrtSession.SessionOptions());
            System.out.println("Makao AI Model V3 loaded successfully (93 actions, multi-card support).");
        } catch (Exception e) {
            System.err.println("CRITICAL ERROR: Failed to load ONNX model.");
            e.printStackTrace();
        }
    }
    
    /**
     * Resetuje historię odrzuconych kart (wywołaj na początku nowej gry).
     */
    public void resetGame() {
        discardPile.clear();
    }
    
    /**
     * Dodaje kartę do historii odrzuconych (wywołaj po każdym zagraniu karty).
     */
    public void addToDiscard(String card) {
        if (card != null) {
            discardPile.add(card);
        }
    }
    
    /**
     * Dodaje wiele kart do historii odrzuconych.
     */
    public void addToDiscard(List<String> cards) {
        if (cards != null) {
            discardPile.addAll(cards);
        }
    }

    public AIAction predictMove(MakaoGame game, MakaoPlayer aiPlayer, MakaoPlayer opponent) {
        logAIHand(aiPlayer);
        if (session == null) {
            System.err.println("AI Error: Session is null (Model not loaded)");
            return null;
        }

        try {
            // 1. Prepare Observation (180 floats)
            float[] obs = createObservation(game, aiPlayer, opponent);
            
            // 2. Prepare Action Mask (93 bools)
            boolean[] mask = createActionMask(game, aiPlayer);
            
            // 3. Run Inference
            OnnxTensor obsTensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(obs), new long[]{1, OBS_SIZE});
            
            boolean[][] maskArray = new boolean[1][ACTION_SIZE];
            maskArray[0] = mask;
            OnnxTensor maskTensor = OnnxTensor.createTensor(env, maskArray);

            Map<String, OnnxTensor> inputs = new HashMap<>();
            inputs.put("observation", obsTensor);
            inputs.put("action_masks", maskTensor);

            OrtSession.Result result = session.run(inputs);
            
            // 4. Get Output (Logits)
            float[][] logits = (float[][]) result.get(0).getValue();
            float[] actionLogits = logits[0];
            
            // Close tensors
            obsTensor.close();
            maskTensor.close();
            result.close();
            
            // 5. Select Best Valid Action (Argmax with Mask)
            int bestAction = -1;
            float maxVal = -Float.MAX_VALUE;

            // Calculate Softmax probabilities
            double[] probs = new double[ACTION_SIZE];
            double sumExp = 0.0;
            float maxLogit = -Float.MAX_VALUE;
            for (float l : actionLogits) maxLogit = Math.max(maxLogit, l);

            for (float logit : actionLogits) {
                sumExp += Math.exp(logit - maxLogit);
            }
            for (int i = 0; i < ACTION_SIZE; i++) {
                probs[i] = Math.exp(actionLogits[i] - maxLogit) / sumExp;
            }
            
            for (int i = 0; i < ACTION_SIZE; i++) {
                if (mask[i]) {
                    if (actionLogits[i] > maxVal) {
                        maxVal = actionLogits[i];
                        bestAction = i;
                    }
                }
            }

            // Log decision details
            if (bestAction != -1) {
                AIAction chosen = decodeAction(bestAction, aiPlayer);
                String actionDesc = formatAction(chosen);
                double confidence = probs[bestAction] * 100.0;
                System.out.printf("AI Decision: %s (Confidence: %.2f%%)%n", actionDesc, confidence);

                // Log alternatives
                System.out.print("  Alternatives: ");
                boolean first = true;
                int altCount = 0;
                for (int i = 0; i < ACTION_SIZE && altCount < 5; i++) {
                    if (mask[i] && i != bestAction && probs[i] > 0.01) {
                        if (!first) System.out.print(", ");
                        AIAction cand = decodeAction(i, aiPlayer);
                        System.out.printf("%s (%.1f%%)", formatAction(cand), probs[i] * 100.0);
                        first = false;
                        altCount++;
                    }
                }
                if (first) System.out.print("none");
                System.out.println();
            }
            
            // 6. Convert to AIAction
            return decodeAction(bestAction, aiPlayer);

        } catch (Exception e) {
            System.err.println("AI Prediction Error: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    private float[] createObservation(MakaoGame game, MakaoPlayer aiPlayer, MakaoPlayer opponent) {
        float[] obs = new float[OBS_SIZE];
        
        // 0-51: My Hand (one-hot)
        for (String card : aiPlayer.getHand()) {
            int idx = cardMap.indexOf(card);
            if (idx != -1) obs[idx] = 1.0f;
        }
        
        // 52-103: Table Card (one-hot)
        if (game.getTableCard() != null) {
            int idx = cardMap.indexOf(game.getTableCard());
            if (idx != -1) obs[52 + idx] = 1.0f;
        }
        
        // 104-155: Discarded cards (counter, normalized to 0.25 per card)
        for (String card : discardPile) {
            int idx = cardMap.indexOf(card);
            if (idx != -1) {
                obs[104 + idx] = Math.min(obs[104 + idx] + 0.25f, 1.0f);
            }
        }
        
        // 156: Pending Draw
        obs[156] = Math.min(game.getPendingDrawCount() / 20.0f, 1.0f);
        
        // 157: Pending Skip
        obs[157] = Math.min(game.getPendingSkipTurns() / 5.0f, 1.0f);
        
        // 158-161: Required Suit (one-hot)
        if (game.getCurrentSuit() != null) {
            int sIdx = suits.indexOf(game.getCurrentSuit());
            if (sIdx != -1) obs[158 + sIdx] = 1.0f;
        }
        
        // 162-174: Required Rank (one-hot)
        if (game.getRequiredNumber() != null) {
            int rIdx = ranks.indexOf(game.getRequiredNumber());
            if (rIdx != -1) obs[162 + rIdx] = 1.0f;
        }
        
        // 175: Opponent Hand Size
        if (opponent != null) {
            obs[175] = Math.min(opponent.getHandSize() / 20.0f, 1.0f);
        }
        
        // 176: Deck Size (estimate based on cards in play)
        int totalCards = 52;
        int cardsInPlay = aiPlayer.getHandSize() + 
                         (opponent != null ? opponent.getHandSize() : 0) + 
                         1 + // table card
                         discardPile.size();
        int deckSize = Math.max(0, totalCards - cardsInPlay);
        obs[176] = Math.min(deckSize / 40.0f, 1.0f);
        
        // 177: My Hand Size
        obs[177] = Math.min(aiPlayer.getHandSize() / 20.0f, 1.0f);
        
        // 178: Card Difference (my - opponent, normalized)
        if (opponent != null) {
            int diff = aiPlayer.getHandSize() - opponent.getHandSize();
            obs[178] = Math.max(-1.0f, Math.min(1.0f, diff / 10.0f));
        }
        
        // 179: Close to win flag
        obs[179] = aiPlayer.getHandSize() <= 2 ? 1.0f : 0.0f;
        
        return obs;
    }

    private boolean[] createActionMask(MakaoGame game, MakaoPlayer aiPlayer) {
        boolean[] mask = new boolean[ACTION_SIZE];
        List<String> hand = aiPlayer.getHand();
        
        // Check if must skip
        boolean isSkipping = (game.getPendingSkipTurns() > 0 && 
                              game.getPlayerToSkip() != null && 
                              game.getPlayerToSkip().equals(aiPlayer.getUserId()));
        
        if (isSkipping) {
            mask[92] = true; // Skip only
            return mask;
        }
        
        boolean hasPlayable = false;
        
        // 1. Single Card Plays (0-51)
        for (int i = 0; i < 52; i++) {
            String card = cardMap.get(i);
            if (hand.contains(card)) {
                if (game.canPlayCard(card, game.getTableCard(), game.getCurrentSuit(), aiPlayer.getUserId())) {
                    mask[i] = true;
                    hasPlayable = true;
                }
            }
        }
        
        // 2. Multi-Card Plays
        // Count cards by rank
        Map<String, List<String>> rankCards = new HashMap<>();
        for (String card : hand) {
            String rank = card.substring(0, 1);
            rankCards.computeIfAbsent(rank, k -> new ArrayList<>()).add(card);
        }
        
        for (int rankIdx = 0; rankIdx < 13; rankIdx++) {
            String rank = ranks.get(rankIdx);
            List<String> cardsOfRank = rankCards.getOrDefault(rank, Collections.emptyList());
            
            if (cardsOfRank.size() >= 2) {
                // Check if any card of this rank can be played
                String sampleCard = cardsOfRank.get(0);
                if (game.canPlayCard(sampleCard, game.getTableCard(), game.getCurrentSuit(), aiPlayer.getUserId())) {
                    mask[52 + rankIdx] = true;  // 2x
                    hasPlayable = true;
                    
                    if (cardsOfRank.size() >= 3) {
                        mask[65 + rankIdx] = true;  // 3x
                    }
                    if (cardsOfRank.size() >= 4) {
                        mask[78 + rankIdx] = true;  // 4x
                    }
                }
            }
        }
        
        // 3. Draw - only when no playable cards or pending draw
        if (!hasPlayable || game.getPendingDrawCount() > 0) {
            mask[91] = true;
        }
        
        // Fallback
        boolean anyValid = false;
        for (boolean m : mask) if (m) { anyValid = true; break; }
        if (!anyValid) {
            mask[91] = true; // Force draw as fallback
        }
        
        return mask;
    }

    private AIAction decodeAction(int actionIdx, MakaoPlayer aiPlayer) {
        AIAction action = new AIAction();
        List<String> hand = aiPlayer.getHand();
        
        if (actionIdx < 52) {
            // Single card play
            action.type = "PLAY";
            String card = cardMap.get(actionIdx);
            action.cards.add(card);
            
            // Heuristics for Ace/Jack
            if (card.startsWith("A")) {
                action.chosenSuit = getMostFrequentSuit(aiPlayer);
            } else if (card.startsWith("J")) {
                action.chosenNumber = getBestJackNumber(aiPlayer);
            }
            
        } else if (actionIdx >= 52 && actionIdx <= 64) {
            // 2x card play
            action.type = "PLAY";
            int rankIdx = actionIdx - 52;
            String rank = ranks.get(rankIdx);
            action.cards = getCardsOfRank(hand, rank, 2);
            setSpecialCardChoices(action, aiPlayer);
            
        } else if (actionIdx >= 65 && actionIdx <= 77) {
            // 3x card play
            action.type = "PLAY";
            int rankIdx = actionIdx - 65;
            String rank = ranks.get(rankIdx);
            action.cards = getCardsOfRank(hand, rank, 3);
            setSpecialCardChoices(action, aiPlayer);
            
        } else if (actionIdx >= 78 && actionIdx <= 90) {
            // 4x card play
            action.type = "PLAY";
            int rankIdx = actionIdx - 78;
            String rank = ranks.get(rankIdx);
            action.cards = getCardsOfRank(hand, rank, 4);
            setSpecialCardChoices(action, aiPlayer);
            
        } else if (actionIdx == 91) {
            action.type = "DRAW";
            
        } else if (actionIdx == 92) {
            action.type = "SKIP";
        }
        
        return action;
    }
    
    private List<String> getCardsOfRank(List<String> hand, String rank, int count) {
        List<String> result = new ArrayList<>();
        for (String card : hand) {
            if (card.startsWith(rank) && result.size() < count) {
                result.add(card);
            }
        }
        return result;
    }
    
    private void setSpecialCardChoices(AIAction action, MakaoPlayer aiPlayer) {
        if (action.cards.isEmpty()) return;
        String firstCard = action.cards.get(0);
        
        if (firstCard.startsWith("A")) {
            action.chosenSuit = getMostFrequentSuit(aiPlayer);
        } else if (firstCard.startsWith("J")) {
            action.chosenNumber = getBestJackNumber(aiPlayer);
        }
    }

    private String getMostFrequentSuit(MakaoPlayer player) {
        Map<String, Integer> counts = new HashMap<>();
        for (String s : suits) counts.put(s, 0);
        
        for (String c : player.getHand()) {
            if (c.length() >= 2) {
                String s = c.substring(1);
                counts.put(s, counts.getOrDefault(s, 0) + 1);
            }
        }
        
        return Collections.max(counts.entrySet(), Map.Entry.comparingByValue()).getKey();
    }
    
    private String getBestJackNumber(MakaoPlayer player) {
        // Find most frequent non-special rank
        Map<String, Integer> counts = new HashMap<>();
        List<String> specialRanks = List.of("J", "2", "3", "4", "A");
        
        for (String card : player.getHand()) {
            if (card.length() >= 1) {
                String rank = card.substring(0, 1);
                if (!specialRanks.contains(rank)) {
                    counts.put(rank, counts.getOrDefault(rank, 0) + 1);
                }
            }
        }
        
        if (counts.isEmpty()) {
            return "5"; // Safe default
        }
        
        return Collections.max(counts.entrySet(), Map.Entry.comparingByValue()).getKey();
    }

    private void logAIHand(MakaoPlayer aiPlayer) {
        StringBuilder sb = new StringBuilder();
        sb.append("AI Hand: [");
        List<String> hand = aiPlayer.getHand();
        for (int i = 0; i < hand.size(); i++) {
            sb.append(formatCard(hand.get(i)));
            if (i < hand.size() - 1) {
                sb.append(", ");
            }
        }
        sb.append("]");
        System.out.println(sb.toString());
    }

    private String formatAction(AIAction action) {
        if ("PLAY".equals(action.type)) {
            if (action.cards.size() == 1) {
                return "PLAY " + formatCard(action.cards.get(0));
            } else {
                StringBuilder sb = new StringBuilder("PLAY ");
                sb.append(action.cards.size()).append("x ");
                for (int i = 0; i < action.cards.size(); i++) {
                    sb.append(formatCard(action.cards.get(i)));
                    if (i < action.cards.size() - 1) sb.append("+");
                }
                return sb.toString();
            }
        }
        return action.type;
    }

    private String formatCard(String card) {
        if (card == null || card.length() < 2) return card;
        char rankChar = card.charAt(0);
        char suitChar = card.charAt(1);

        String rankStr;
        if (rankChar == 'T') rankStr = "10";
        else rankStr = String.valueOf(rankChar);

        String suitStr;
        switch (suitChar) {
            case 'H': suitStr = "❤️"; break;
            case 'D': suitStr = "♦️"; break;
            case 'C': suitStr = "♣️"; break;
            case 'S': suitStr = "♠️"; break;
            default: suitStr = String.valueOf(suitChar);
        }

        return rankStr + suitStr;
    }
}
