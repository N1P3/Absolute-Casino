package com.absoluteCasino.control.games.makao;

import com.absoluteCasino.control.games.GameSession;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.java.Log;

@Log
@Getter
@Setter
public class MakaoGameSession extends GameSession {

    private MakaoGameRoom gameRoom;
    private MakaoGame makaoGame;

    public MakaoGameSession(String sessionId, Integer userId) {
        super(sessionId, userId);
        this.makaoGame = new MakaoGame();
    }

    public void setGameRoom(MakaoGameRoom gameRoom) { this.gameRoom = gameRoom; }
    public MakaoGameRoom getGameRoom() { return gameRoom; }

    public MakaoGameResponse playCard(Integer playerId, int cardIndex, String chosenSuit, String chosenNumber, String chosenValue) {
        if (gameRoom == null || !gameRoom.isGameActive()) return error("Gra nie jest aktywna");
        MakaoPlayer current = gameRoom.getCurrentPlayer();
        if (current == null || !current.getUserId().equals(playerId)) return error("Nie Twoja tura");
        if (cardIndex < 0 || cardIndex >= current.getHand().size()) return error("Nieprawidłowy indeks karty");

        String card = current.getHand().get(cardIndex);
        MakaoGame game = gameRoom.getGame();
        String tableCard = game.getTableCard();
        String activeSuit = game.getCurrentSuit();

        if (!game.canPlayCard(card, tableCard, activeSuit, playerId)) return error("Nie możesz zagrać tej karty");

        char value = card.charAt(0);
        char suit = card.charAt(1);

        // Remove the card from hand
        current.removeCard(card);

        // Update table card
        game.setTableCard(card);

        // Handle card effects
        if (value == 'A') {
            if (chosenSuit == null || chosenSuit.isEmpty()) return error("Musisz wybrać kolor po Asie");
            game.setCurrentSuit(chosenSuit);
            game.setRequiredNumber(null);
            game.setRequirementTurnsLeft(2); // Lasts for setter's next turn + 1 opponent turn
        } else if (value == 'J') {
            if (chosenNumber == null || chosenNumber.isEmpty()) return error("Musisz wybrać liczbę po Walecie");
            char num = chosenNumber.charAt(0);
            if (!(num >= '5' && num <= '9' || num == 'T')) return error("Nieprawidłowa liczba (5-10)");
            game.setRequiredNumber(num);
            game.setCurrentSuit(null);
            game.setRequirementTurnsLeft(2); // Lasts for setter's next turn + 1 opponent turn
        } else {
            // Decrement requirement turns counter
            if (game.getRequirementTurnsLeft() > 0) {
                game.setRequirementTurnsLeft(game.getRequirementTurnsLeft() - 1);

                // Clear requirements when counter reaches 0
                if (game.getRequirementTurnsLeft() == 0) {
                    game.setCurrentSuit(null);
                    game.setRequiredNumber(null);
                }
            }
        }

        // Apply draw stacking logic and skip turn logic
        if (value == '2') {
            if (game.getPendingDrawCount() == 0) game.setDrawType("2");
            game.setPendingDrawCount(game.getPendingDrawCount() + 2);
        } else if (value == '3') {
            if (game.getPendingDrawCount() == 0) game.setDrawType("3");
            game.setPendingDrawCount(game.getPendingDrawCount() + 3);
        } else if (value == '4') {
            // When a 4 is played, get the next player who will need to skip
            MakaoPlayer nextPlayer = gameRoom.getPlayers().get((gameRoom.getCurrentPlayerIndex() + 1) % gameRoom.getPlayers().size());

            if (game.getPlayerToSkip() != null && game.getPlayerToSkip().equals(playerId)) {
                // This player was supposed to skip but countered with a 4
                // Now pass the penalty back to the opponent with increased count
                game.setPlayerToSkip(nextPlayer.getUserId());
                game.setPendingSkipTurns(game.getPendingSkipTurns() + 1);
            } else {
                // New 4 penalty - next player must skip
                game.setPlayerToSkip(nextPlayer.getUserId());
                game.setPendingSkipTurns(game.getPendingSkipTurns() + 1);
            }
        } else if (value == 'K' && (suit == 'H' || suit == 'S')) {
            if (game.getPendingDrawCount() == 0) game.setDrawType("K");
            game.setPendingDrawCount(game.getPendingDrawCount() + 5);
        } else {
            // Playing a non-special card clears draw stack
            if (game.getPendingDrawCount() > 0) {
                game.setPendingDrawCount(0);
                game.setDrawType(null);
            }
            // Note: skip turns are NOT cleared here - they must be paid turn by turn
        }

        // Win check
        if (current.getHand().isEmpty()) {
            gameRoom.setGameActive(false);
            gameRoom.setWinner(current);
            return gameOver(current.getUserId(), true);
        }

        gameRoom.getNextPlayer();
        return state();
    }

    public MakaoGameResponse drawCard(Integer playerId) {
        if (gameRoom == null || !gameRoom.isGameActive()) return error("Gra nie jest aktywna");
        MakaoPlayer current = gameRoom.getCurrentPlayer();
        if (current == null || !current.getUserId().equals(playerId)) return error("Nie Twoja tura");
        MakaoGame game = gameRoom.getGame();

        // Decrement requirement turns when drawing
        if (game.getRequirementTurnsLeft() > 0) {
            game.setRequirementTurnsLeft(game.getRequirementTurnsLeft() - 1);

            // Clear requirements when counter reaches 0
            if (game.getRequirementTurnsLeft() == 0) {
                game.setCurrentSuit(null);
                game.setRequiredNumber(null);
            }
        }

        int toDraw = game.getPendingDrawCount() > 0 ? game.getPendingDrawCount() : 1;
        for (int i = 0; i < toDraw; i++) current.addCard(gameRoom.drawCard());
        if (game.getPendingDrawCount() > 0) {
            game.setPendingDrawCount(0);
            game.setDrawType(null);
        }
        gameRoom.getNextPlayer();
        return state();
    }

    public MakaoGameResponse skipTurn(Integer playerId) {
        if (gameRoom == null || !gameRoom.isGameActive()) return error("Gra nie jest aktywna");
        MakaoPlayer current = gameRoom.getCurrentPlayer();
        if (current == null || !current.getUserId().equals(playerId)) return error("Nie Twoja tura");
        MakaoGame game = gameRoom.getGame();

        // Can only skip if this player is marked to skip
        if (game.getPlayerToSkip() == null || !game.getPlayerToSkip().equals(playerId)) {
            return error("Nie musisz pomijać tury");
        }

        // Decrement requirement turns when skipping
        if (game.getRequirementTurnsLeft() > 0) {
            game.setRequirementTurnsLeft(game.getRequirementTurnsLeft() - 1);

            // Clear requirements when counter reaches 0
            if (game.getRequirementTurnsLeft() == 0) {
                game.setCurrentSuit(null);
                game.setRequiredNumber(null);
            }
        }

        // Decrement pending skip turns by 1
        game.setPendingSkipTurns(game.getPendingSkipTurns() - 1);

        // If no more skips remaining, clear the penalty
        if (game.getPendingSkipTurns() <= 0) {
            game.setPlayerToSkip(null);
            game.setPendingSkipTurns(0);
        }

        // Move to next player - they can play normally
        gameRoom.getNextPlayer();

        return state();
    }

    private MakaoGameResponse state() {
        MakaoGameResponse r = new MakaoGameResponse();
        r.setType("GAME_STATE");
        MakaoPlayer me = gameRoom.getPlayerByUserId(getUserId());
        if (me == null) return error("Gracz nie znaleziony");
        MakaoPlayer opponent = gameRoom.getPlayers().stream().filter(p -> !p.getUserId().equals(getUserId())).findFirst().orElse(null);
        MakaoPlayer current = gameRoom.getCurrentPlayer();
        MakaoGame g = gameRoom.getGame();
        r.setPlayerHand(me.getHand());
        r.setOpponentHandCount(opponent != null ? opponent.getHandSize() : 0);
        r.setTableCard(g.getTableCard());
        r.setCurrentSuit(g.getCurrentSuit());
        r.setRequiredNumber(g.getRequiredNumber());
        r.setPendingDrawCount(g.getPendingDrawCount());
        r.setDrawType(g.getDrawType());
        r.setPendingSkipTurns(g.getPendingSkipTurns());
        r.setPlayerToSkip(g.getPlayerToSkip());
        r.setCurrentPlayerId(current.getUserId());
        r.setCurrentPlayerName(current.getUserName());
        r.setGameOver(false);
        r.setPlayers(gameRoom.getPlayers().stream().map(p -> new MakaoGameResponse.MakaoPlayerInfo(p.getUserId(), p.getUserName(), p.getHandSize(), p.getUserId().equals(current.getUserId()))).toList());
        return r;
    }

    private MakaoGameResponse gameOver(Integer winnerId, boolean win) {
        MakaoGameResponse r = new MakaoGameResponse();
        r.setType("GAME_OVER");
        r.setGameOver(true);
        r.setResult(win ? "WIN" : "LOSE");
        r.setTableCard(gameRoom.getGame().getTableCard());
        r.setPlayers(gameRoom.getPlayers().stream().map(p -> new MakaoGameResponse.MakaoPlayerInfo(p.getUserId(), p.getUserName(), p.getHandSize(), p.getUserId().equals(winnerId))).toList());
        MakaoPlayer me = gameRoom.getPlayerByUserId(getUserId());
        if (me != null) r.setPlayerHand(me.getHand());
        return r;
    }

    private MakaoGameResponse error(String msg) {
        MakaoGameResponse r = new MakaoGameResponse();
        r.setType("ERROR");
        r.setMessage(msg);
        return r;
    }
}
