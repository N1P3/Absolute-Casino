package com.absoluteCasino.control.games.poker;

import com.absoluteCasino.control.utils.CardsShoe;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HoldemActionRulesTest {

	@Test
	void availableActions_allowCheckWhenSeatAlreadyMatchedBet() {
		HoldemTable table = new HoldemTable(1, 2, new Blinds(10, 20), 100L, 1000L);
		table.getSeat(0).setUserId(11L);
		table.getSeat(0).setStack(900L);
		table.getSeat(1).setUserId(22L);
		table.getSeat(1).setStack(900L);

		HoldemHand hand = new HoldemHand(1, new CardsShoe(1));
		table.setCurrentHand(hand);
		hand.setCurrentPlayerSeat(0);
		hand.setCurrentBet(100L);

		PlayerHandState actingPlayer = new PlayerHandState(0);
		actingPlayer.setChipsInPotThisStreet(100L);
		hand.getPlayers().put(0, actingPlayer);
		hand.getPlayers().put(1, new PlayerHandState(1));

		List<String> actions = table.getAvailableActionsForSeat(0);

		assertTrue(actions.contains("CHECK"));
		assertFalse(actions.contains("CALL"));
	}

	@Test
	void availableActions_afterAllInOfferCallNotCheck() {
		HoldemGameService service = new HoldemGameService();
		service.joinTable(99, 11L, 1000L);
		service.joinTable(99, 22L, 1000L);
		service.startHandIfPossible(99);

		HoldemTable table = service.getTable(99);
		HoldemHand hand = table.getCurrentHand();
		assertEquals(1, hand.getCurrentPlayerSeat());
		assertEquals(10L, hand.getPlayers().get(1).getChipsInPotThisStreet());

		String error = service.handlePlayerAction(99, 22L, PlayerActionType.ALL_IN, 0L);
		assertNull(error);
		assertEquals(0, hand.getCurrentPlayerSeat());
		assertEquals(BettingStreet.PREFLOP, hand.getStreet());
		assertEquals(1000L, hand.getCurrentBet());

		List<String> actions = table.getAvailableActionsForSeat(0);

		assertTrue(actions.contains("CALL"));
		assertFalse(actions.contains("CHECK"));
	}
}