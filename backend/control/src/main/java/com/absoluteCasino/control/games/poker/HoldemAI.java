package com.absoluteCasino.control.games.poker;

import ai.onnxruntime.*;
import com.absoluteCasino.control.utils.Seat;

import java.io.InputStream;
import java.nio.FloatBuffer;
import java.util.*;

public class HoldemAI {

	private OrtEnvironment env;
	private OrtSession session;
	private final List<String> ranks = List.of("2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A");
	private final List<String> suits = List.of("s", "h", "d", "c"); // Spades, Hearts, Diamonds, Clubs

	public static class AIAction {
		public PlayerActionType type;
		public long raiseAmount; // Only if type is RAISE (or BET/ALL_IN mapped to RAISE)
	}

	public HoldemAI() {
		try {
			env = OrtEnvironment.getEnvironment();

			// 1. Create temporary directory for model files
			java.nio.file.Path tempDir = java.nio.file.Files.createTempDirectory("absolute_casino_holdem_");
			tempDir.toFile().deleteOnExit();

			// 2. Extract main model file
			java.nio.file.Path modelPath = tempDir.resolve("holdem_model.onnx");
			try (InputStream is = getClass().getResourceAsStream("/onnx/holdem_model.onnx")) {
				if (is == null) {
					System.err.println("HoldemAI WARNING: Model not found at /onnx/holdem_model.onnx");
					return;
				}
				java.nio.file.Files.copy(is, modelPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
				modelPath.toFile().deleteOnExit();
			}

			// 3. Extract external data file (required for large models)
			java.nio.file.Path dataPath = tempDir.resolve("holdem_model.onnx.data");
			try (InputStream is = getClass().getResourceAsStream("/onnx/holdem_model.onnx.data")) {
				if (is != null) {
					java.nio.file.Files.copy(is, dataPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
					dataPath.toFile().deleteOnExit();
				}
			}

			// 4. Load session from the temporary file path
			// This allows ONNX Runtime to find the adjacent .data file
			session = env.createSession(modelPath.toString(), new OrtSession.SessionOptions());

			System.out.println("Holdem AI Model loaded successfully from: " + modelPath);
		} catch (Exception e) {
			System.err.println("HoldemAI Critical Error: Failed to load ONNX model");
			e.printStackTrace();
		}
	}

	public AIAction predictMove(HoldemTable table, Seat aiSeat) {
		HoldemHand hand = table.getCurrentHand();
		if (hand == null)
			return null;

		// Fallback if model is not loaded
		if (session == null) {
			return playBasicStrategy(table, hand, aiSeat);
		}

		try {
			// 1. Prepare Inputs
			float[] staticState = createStaticState(table, hand, aiSeat);
			float[][][] actionSequence = createActionSequence(table, hand, aiSeat);

			// 2. Create Tensors
			OnnxTensor staticTensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(staticState), new long[] { 1, 18 });
			OnnxTensor actionTensor = OnnxTensor.createTensor(env, actionSequence); // shape [1, 20, 10] inferred from
																					// array

			Map<String, OnnxTensor> inputs = new HashMap<>();
			inputs.put("static_state", staticTensor);
			inputs.put("action_sequence", actionTensor);

			// 3. Run Inference
			OrtSession.Result result = session.run(inputs);

			// 4. Extract Outputs
			// action_logits: [1, 3]
			// value_pred: [1, 1]
			float[][] logits = (float[][]) result.get(0).getValue();
			float[][] value = (float[][]) result.get(1).getValue();

			float[] actionProbs = softmax(logits[0]);
			float predictedValue = value[0][0];

			// 5. Decode Action
			AIAction action = decodeAction(actionProbs, predictedValue, hand, table, aiSeat);

			// Clean up
			staticTensor.close();
			actionTensor.close();
			result.close();

			return action;

		} catch (Exception e) {
			System.err.println("HoldemAI Prediction Error: " + e.getMessage());
			e.printStackTrace();
			return playBasicStrategy(table, hand, aiSeat);
		}
	}

	private AIAction playBasicStrategy(HoldemTable table, HoldemHand hand, Seat aiSeat) {
		AIAction action = new AIAction();
		long toCall = getToCall(hand, aiSeat.getPosition());

		// Simple logic:
		// Always Check if possible
		// Call if cost is low (< 5% of stack) or has high pair? (No we don't know cards
		// here easily w/o parsing)
		// For now: 80% Call/Check, 20% Fold if big bet, 10% Raise

		if (toCall == 0) {
			action.type = PlayerActionType.CHECK;
		} else {
			// 80% CALL, 20% FOLD
			if (Math.random() < 0.8) {
				action.type = PlayerActionType.CALL;
			} else {
				action.type = PlayerActionType.FOLD;
			}
		}
		return action;
	}

	private long getToCall(HoldemHand hand, int seatPosition) {
		return Math.max(0L, hand.getCurrentBet() - hand.getBetThisStreetForSeat(seatPosition));
	}

	private float[] createStaticState(HoldemTable table, HoldemHand hand, Seat aiSeat) {
		float[] state = new float[18];
		int ptr = 0;

		// 1. Hole Cards (2)
		List<String> holeCards = hand.getHoleCardsForSeat(aiSeat.getPosition());
		for (int i = 0; i < 2; i++) {
			if (i < holeCards.size()) {
				state[ptr++] = encodeCard(holeCards.get(i));
			} else {
				state[ptr++] = 52f; // UNKNOWN_CARD
			}
		}

		// 2. Board Cards (5)
		List<String> board = hand.getCommunityCards();
		for (int i = 0; i < 5; i++) {
			if (i < board.size()) {
				state[ptr++] = encodeCard(board.get(i));
			} else {
				state[ptr++] = 52f;
			}
		}

		// 3. Stacks (6) - Rotated relative to AI
		int maxSeats = table.getMaxSeats();
		int aiPos = aiSeat.getPosition();
		long maxStack = 1L; // Avoid div/0

		// Find max stack for normalization
		for (Seat s : table.getSeats()) {
			if (s.isOccupied())
				maxStack = Math.max(maxStack, s.getStack());
		}

		for (int i = 0; i < 6; i++) {
			int targetPos = (aiPos + i) % maxSeats;
			Seat targetSeat = table.getSeat(targetPos);
			float stackVal = 0f;
			if (targetSeat != null && targetSeat.isOccupied()) {
				stackVal = (float) targetSeat.getStack() / maxStack;
			}
			state[ptr++] = stackVal;
		}

		// 4. Pot (1)
		state[ptr++] = (float) hand.getPot() / maxStack; // Normalized by max stack same as stacks

		// 5. Street (4) - One hot
		BettingStreet street = hand.getStreet();
		state[ptr++] = street == BettingStreet.PREFLOP ? 1f : 0f;
		state[ptr++] = street == BettingStreet.FLOP ? 1f : 0f;
		state[ptr++] = street == BettingStreet.TURN ? 1f : 0f;
		state[ptr++] = street == BettingStreet.RIVER ? 1f : 0f;

		return state;
	}

	private float[][][] createActionSequence(HoldemTable table, HoldemHand hand, Seat aiSeat) {
		float[][][] seq = new float[1][20][10]; // [Batch, Time, Features]

		List<HoldemHand.ActionRecord> history = hand.getActionHistory();
		int startIdx = Math.max(0, history.size() - 20);
		int seqIdx = 0;

		int maxSeats = table.getMaxSeats();
		int aiPos = aiSeat.getPosition();

		for (int i = startIdx; i < history.size(); i++) {
			HoldemHand.ActionRecord rec = history.get(i);

			// 1. One-hot player (relative)
			int relPos = (rec.playerSeat() - aiPos + maxSeats) % maxSeats;
			if (relPos < 6) {
				seq[0][seqIdx][relPos] = 1.0f;
			}

			// 2. One-hot action type
			int actionTypeOffset = 6;
			// Map types: 0=FOLD, 1=CALL, 2=RAISE
			int typeIdx = 0;
			if (rec.type() == PlayerActionType.FOLD)
				typeIdx = 0;
			else if (rec.type() == PlayerActionType.CHECK || rec.type() == PlayerActionType.CALL)
				typeIdx = 1;
			else
				typeIdx = 2; // BET, RAISE, ALL_IN

			if (typeIdx < 3) {
				seq[0][seqIdx][actionTypeOffset + typeIdx] = 1.0f;
			}

			// 3. Amount
			float normAmount = (float) rec.amount() / Math.max(1, hand.getPot());
			seq[0][seqIdx][9] = normAmount;

			seqIdx++;
		}

		return seq;
	}

	private float encodeCard(String card) {
		if (card == null || card.length() < 2)
			return 52f;
		// Input: "Ah", "Kd", "Ts", "2c" ...
		// Expected ranks: 2,3,4,5,6,7,8,9,T,J,Q,K,A
		// Expected suits: s, h, d, c

		String r = card.substring(0, 1);
		String s = card.substring(1, 2);

		// Handle '10' which might be '10' or 'T'?
		// CardsShoe uses DeckOfCards.createDeck which typically uses "2"-"9", "10",
		// "J"...
		// But "10" is 2 chars. HandEvaluator logic handles strings.
		// Let's assume standard strings. If "10s", r="1", s="0"? No.
		if (card.length() == 3 && card.startsWith("10")) {
			r = "T";
			s = card.substring(2, 3);
		}

		int rIdx = ranks.indexOf(r);
		int sIdx = suits.indexOf(s.toLowerCase());

		if (rIdx == -1 || sIdx == -1)
			return 52f;

		// rank * 4 + suit
		return (float) (rIdx * 4 + sIdx);
	}

	private AIAction decodeAction(float[] probs, float valPred, HoldemHand hand, HoldemTable table, Seat aiSeat) {
		// probs: [Fold, Call, Raise]
		int bestIdx = -1;
		float maxP = -1f;

		// Simple Argmax for now, can add sampling temperature later
		for (int i = 0; i < 3; i++) {
			if (probs[i] > maxP) {
				maxP = probs[i];
				bestIdx = i;
			}
		}

		AIAction action = new AIAction();

		switch (bestIdx) {
		case 0:
			action.type = PlayerActionType.FOLD;
			break;
		case 1:
			action.type = getToCall(hand, aiSeat.getPosition()) == 0 ? PlayerActionType.CHECK : PlayerActionType.CALL;
			break;
		case 2:
			// Raise
			// Calculate amount from valPred (which is log(multiple))
			// raise_amount_pot_multiple = exp(val_pred)
			// amount = multiple * pot

			double multiple = Math.exp(valPred);
			long pot = Math.max(1, hand.getPot());
			long raiseAmt = (long) (multiple * pot);

			// Clamp and Ensure rules
			long currentBet = hand.getCurrentBet();
			long minRaise = Math.max(table.getBlinds().bigBlind(), hand.getLastRaiseSize());
			long minTotal = currentBet + minRaise;

			if (currentBet == 0) {
				action.type = PlayerActionType.BET;
				if (raiseAmt < table.getBlinds().bigBlind())
					raiseAmt = table.getBlinds().bigBlind();
			} else {
				action.type = PlayerActionType.RAISE;
				if (raiseAmt < minTotal)
					raiseAmt = minTotal;
			}

			action.raiseAmount = raiseAmt;
			break;
		}
		return coerceActionForCurrentBet(action, hand, aiSeat);
	}

	private AIAction coerceActionForCurrentBet(AIAction action, HoldemHand hand, Seat aiSeat) {
		if (action == null || action.type == null) {
			return action;
		}

		long toCall = getToCall(hand, aiSeat.getPosition());
		if (action.type == PlayerActionType.CHECK && toCall > 0) {
			action.type = PlayerActionType.CALL;
		} else if (action.type == PlayerActionType.CALL && toCall == 0) {
			action.type = PlayerActionType.CHECK;
		}

		return action;
	}

	private float[] softmax(float[] logits) {
		float max = Float.NEGATIVE_INFINITY;
		for (float f : logits)
			max = Math.max(max, f);
		float sum = 0f;
		float[] probs = new float[logits.length];
		for (int i = 0; i < logits.length; i++) {
			probs[i] = (float) Math.exp(logits[i] - max);
			sum += probs[i];
		}
		for (int i = 0; i < logits.length; i++)
			probs[i] /= sum;
		return probs;
	}
}
