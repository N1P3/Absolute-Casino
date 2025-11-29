package com.absoluteCasino.control.games.makao;

import ai.onnxruntime.*;
import java.io.InputStream;
import java.util.*;
import java.nio.FloatBuffer;

public class MakaoAI {
    private OrtEnvironment env;
    private OrtSession session;
    private final List<String> cardMap;
    private final List<String> suits = List.of("H", "D", "C", "S");
    private final List<String> ranks = List.of("2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A");

    public static class AIAction {
        public String type; // "PLAY", "DRAW", "SKIP"
        public String card;
        public String chosenSuit;
        public String chosenNumber;
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
            System.out.println("Makao AI Model loaded successfully.");
        } catch (Exception e) {
            System.err.println("CRITICAL ERROR: Failed to load ONNX model.");
            e.printStackTrace();
        }
    }

    public AIAction predictMove(MakaoGame game, MakaoPlayer aiPlayer, MakaoPlayer opponent) {
        logAIHand(aiPlayer);
        if (session == null) {
            System.err.println("AI Error: Session is null (Model not loaded)");
            return null;
        }

        try {
            // 1. Prepare Observation
            float[] obs = createObservation(game, aiPlayer, opponent);
            
            // 2. Prepare Action Mask
            boolean[] mask = createActionMask(game, aiPlayer);
            
            // 3. Run Inference
            OnnxTensor obsTensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(obs), new long[]{1, 124});
            
            // Convert boolean mask to boolean tensor
            // ONNX Runtime Java createTensor supports boolean arrays directly?
            // Let's try creating a boolean buffer or just passing the array if supported.
            // The createTensor(env, Object data) is the most generic one.
            boolean[][] maskArray = new boolean[1][54];
            maskArray[0] = mask;
            OnnxTensor maskTensor = OnnxTensor.createTensor(env, maskArray);

            Map<String, OnnxTensor> inputs = new HashMap<>();
            inputs.put("observation", obsTensor);
            inputs.put("action_masks", maskTensor);

            OrtSession.Result result = session.run(inputs);
            
            // 4. Get Output (Logits)
            // The output is likely a float array wrapped in a tensor
            // We need to be careful with casting.
            // If output is [batch, 54], getValue() returns a multi-dim array.
            float[][] logits = (float[][]) result.get(0).getValue();
            float[] actionLogits = logits[0];
            
            // Close tensors to free memory
            obsTensor.close();
            maskTensor.close();
            result.close();
            
            // 5. Select Best Valid Action (Argmax with Mask)
            int bestAction = -1;
            float maxVal = -Float.MAX_VALUE;

            // Calculate Softmax probabilities
            double[] probs = new double[54];
            double sumExp = 0.0;
            // Use max logit for numerical stability
            float maxLogit = -Float.MAX_VALUE;
            for (float l : actionLogits) maxLogit = Math.max(maxLogit, l);

            for (float logit : actionLogits) {
                sumExp += Math.exp(logit - maxLogit);
            }
            for (int i = 0; i < 54; i++) {
                probs[i] = Math.exp(actionLogits[i] - maxLogit) / sumExp;
            }
            
            for (int i = 0; i < 54; i++) {
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

                System.out.print("  Alternatives: ");
                boolean first = true;
                for (int i = 0; i < 54; i++) {
                    if (mask[i] && i != bestAction) {
                        if (!first) System.out.print(", ");
                        AIAction cand = decodeAction(i, aiPlayer);
                        System.out.printf("%s (%.1f%%)", formatAction(cand), probs[i] * 100.0);
                        first = false;
                    }
                }
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
        float[] obs = new float[124];
        
        // 0-51: My Hand
        for (String card : aiPlayer.getHand()) {
            int idx = cardMap.indexOf(card);
            if (idx != -1) obs[idx] = 1.0f;
        }
        
        // 52-103: Table Card
        if (game.getTableCard() != null) {
            int idx = cardMap.indexOf(game.getTableCard());
            if (idx != -1) obs[52 + idx] = 1.0f;
        }
        
        // 104: Pending Draw
        obs[104] = Math.min(game.getPendingDrawCount() / 20.0f, 1.0f);
        
        // 105: Pending Skip
        obs[105] = Math.min(game.getPendingSkipTurns() / 5.0f, 1.0f);
        
        // 106-109: Required Suit
        if (game.getCurrentSuit() != null) {
            int sIdx = suits.indexOf(game.getCurrentSuit());
            if (sIdx != -1) obs[106 + sIdx] = 1.0f;
        }
        
        // 110-122: Required Rank
        if (game.getRequiredNumber() != null) {
            int rIdx = ranks.indexOf(game.getRequiredNumber());
            if (rIdx != -1) obs[110 + rIdx] = 1.0f;
        }
        
        // 123: Opponent Hand Size
        if (opponent != null) {
            obs[123] = Math.min(opponent.getHandSize() / 20.0f, 1.0f);
        }
        
        return obs;
    }

    private boolean[] createActionMask(MakaoGame game, MakaoPlayer aiPlayer) {
        boolean[] mask = new boolean[54];
        
        // 1. Check Card Plays (0-51)
        for (int i = 0; i < 52; i++) {
            String card = cardMap.get(i);
            if (aiPlayer.getHand().contains(card)) {
                if (game.canPlayCard(card, game.getTableCard(), game.getCurrentSuit(), aiPlayer.getUserId())) {
                    mask[i] = true;
                }
            }
        }
        
        // 2. Check Special Actions
        boolean isSkipping = (game.getPendingSkipTurns() > 0 && 
                              game.getPlayerToSkip() != null && 
                              game.getPlayerToSkip().equals(aiPlayer.getUserId()));
        
        if (isSkipping) {
            mask[53] = true; // Skip
            mask[52] = false; // Cannot draw
        } else {
            mask[53] = false; // Cannot skip
            mask[52] = true; // Can always draw
        }
        
        return mask;
    }

    private AIAction decodeAction(int actionIdx, MakaoPlayer aiPlayer) {
        AIAction action = new AIAction();
        
        if (actionIdx < 52) {
            action.type = "PLAY";
            action.card = cardMap.get(actionIdx);
            
            // Heuristics for Ace/Jack
            if (action.card.startsWith("A")) {
                action.chosenSuit = getMostFrequentSuit(aiPlayer);
            } else if (action.card.startsWith("J")) {
                action.chosenNumber = "5"; // Default safe choice
            }
        } else if (actionIdx == 52) {
            action.type = "DRAW";
        } else if (actionIdx == 53) {
            action.type = "SKIP";
        }
        
        return action;
    }

    private String getMostFrequentSuit(MakaoPlayer player) {
        Map<String, Integer> counts = new HashMap<>();
        for (String s : suits) counts.put(s, 0);
        
        for (String c : player.getHand()) {
            String s = c.substring(1);
            counts.put(s, counts.getOrDefault(s, 0) + 1);
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
            return "PLAY " + formatCard(action.card);
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
