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
    private static final MakaoAI makaoAI = new MakaoAI();

    public MakaoGameSession(String sessionId, Integer userId) {
        super(sessionId, userId);
        this.makaoGame = new MakaoGame();
    }

    public void setGameRoom(MakaoGameRoom gameRoom) { this.gameRoom = gameRoom; }
    public MakaoGameRoom getGameRoom() { return gameRoom; }

    public MakaoGameResponse playCard(Integer playerId, java.util.List<Integer> cardIndices, String chosenSuit, String chosenNumber, String chosenValue) {
        if (gameRoom == null || !gameRoom.isGameActive()) return error("Gra nie jest aktywna");
        MakaoPlayer current = gameRoom.getCurrentPlayer();
        if (current == null || !current.getUserId().equals(playerId)) return error("Nie Twoja tura");
        
        if (cardIndices == null || cardIndices.isEmpty()) return error("Nie wybrano kart");

        // Validate indices
        for (int idx : cardIndices) {
            if (idx < 0 || idx >= current.getHand().size()) return error("Nieprawidłowy indeks karty");
        }

        // Get cards to play
        java.util.List<String> cardsToPlay = new java.util.ArrayList<>();
        for (int idx : cardIndices) {
            cardsToPlay.add(current.getHand().get(idx));
        }

        MakaoGame game = gameRoom.getGame();
        
        // Get next player ID for 4-skip logic
        MakaoPlayer nextPlayer = gameRoom.getPlayers().get((gameRoom.getCurrentPlayerIndex() + 1) % gameRoom.getPlayers().size());
        
        // Execute play in game engine
        MakaoGame.PlayResult result = game.playCards(cardsToPlay, chosenSuit, chosenNumber, playerId, nextPlayer.getUserId());
        
        if (!result.success) {
            return error(result.errorMessage);
        }

        // Remove cards from hand (using sorted indices to avoid shifting issues)
        java.util.List<Integer> sortedIndices = new java.util.ArrayList<>(cardIndices);
        sortedIndices.sort(java.util.Collections.reverseOrder());
        for (int idx : sortedIndices) {
            current.getHand().remove((int)idx);
        }

        // Win check
        if (current.getHand().isEmpty()) {
            gameRoom.setGameActive(false);
            gameRoom.setWinner(current);
            return gameOver(current.getUserId(), true);
        }

        gameRoom.getNextPlayer();
        processAiTurns();
        return state();
    }

    public MakaoGameResponse drawCard(Integer playerId) {
        if (gameRoom == null || !gameRoom.isGameActive()) return error("Gra nie jest aktywna");
        MakaoPlayer current = gameRoom.getCurrentPlayer();
        if (current == null || !current.getUserId().equals(playerId)) return error("Nie Twoja tura");
        MakaoGame game = gameRoom.getGame();

        // Execute draw in game engine (handles requirement decrement internally)
        int toDraw = game.drawCards();
        
        // Draw cards
        for (int i = 0; i < toDraw; i++) {
            current.addCard(gameRoom.drawCard());
        }
        
        gameRoom.getNextPlayer();
        processAiTurns();
        return state();
    }

    public MakaoGameResponse skipTurn(Integer playerId) {
        if (gameRoom == null || !gameRoom.isGameActive()) return error("Gra nie jest aktywna");
        MakaoPlayer current = gameRoom.getCurrentPlayer();
        if (current == null || !current.getUserId().equals(playerId)) return error("Nie Twoja tura");
        MakaoGame game = gameRoom.getGame();

        // Execute skip in game engine
        MakaoGame.PlayResult result = game.skipTurn(playerId);
        
        if (!result.success) {
            return error(result.errorMessage);
        }

        gameRoom.getNextPlayer();
        processAiTurns();
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
        if (me != null) {
            r.setPlayerHand(me.getHand());
        }
        // Add opponent hand count for frontend
        MakaoPlayer opponent = gameRoom.getPlayers().stream()
            .filter(p -> !p.getUserId().equals(getUserId()))
            .findFirst()
            .orElse(null);
        if (opponent != null) {
            r.setOpponentHandCount(opponent.getHandSize());
        }
        // Add money won calculation (net profit = winner's bet, since payout is 2x bet)
        MakaoPlayer winner = gameRoom.getWinner();
        if (winner != null && winner.getUserId().equals(getUserId())) {
            // Winner gets 2x their bet, so profit is 1x bet
            r.setMoneyWon(winner.getBet());
        }
        return r;
    }

    private MakaoGameResponse error(String msg) {
        MakaoGameResponse r = new MakaoGameResponse();
        r.setType("ERROR");
        r.setMessage(msg);
        return r;
    }

    private void processAiTurns() {
        if (gameRoom == null || !gameRoom.isGameActive()) return;
        
        MakaoPlayer current = gameRoom.getCurrentPlayer();
        int safetyCounter = 0;
        while (current != null && current.isAi() && gameRoom.isGameActive() && safetyCounter < 10) {
            safetyCounter++;
            
            MakaoPlayer opponent = gameRoom.getPlayers().stream()
                .filter(p -> !p.isAi())
                .findFirst()
                .orElse(null);

            MakaoAI.AIAction action = makaoAI.predictMove(gameRoom.getGame(), current, opponent);
            
            if (action == null) {
                System.err.println("AI failed to predict move");
                break;
            }
            
            MakaoGame game = gameRoom.getGame();
            
            if ("PLAY".equals(action.type)) {
                int nextIdx = (gameRoom.getCurrentPlayerIndex() + 1) % gameRoom.getPlayers().size();
                MakaoPlayer nextPlayer = gameRoom.getPlayers().get(nextIdx);
                
                java.util.List<String> cards = new java.util.ArrayList<>();
                cards.add(action.card);
                
                MakaoGame.PlayResult result = game.playCards(cards, action.chosenSuit, action.chosenNumber, current.getUserId(), nextPlayer.getUserId());
                
                if (result.success) {
                    current.removeCard(action.card);
                    if (current.getHand().isEmpty()) {
                        gameRoom.setGameActive(false);
                        gameRoom.setWinner(current);
                        return;
                    }
                    gameRoom.getNextPlayer();
                } else {
                    int toDraw = game.drawCards();
                    for(int i=0; i<toDraw; i++) current.addCard(gameRoom.drawCard());
                    gameRoom.getNextPlayer();
                }
            } else if ("DRAW".equals(action.type)) {
                int toDraw = game.drawCards();
                for(int i=0; i<toDraw; i++) current.addCard(gameRoom.drawCard());
                gameRoom.getNextPlayer();
            } else if ("SKIP".equals(action.type)) {
                game.skipTurn(current.getUserId());
                gameRoom.getNextPlayer();
            }
            
            current = gameRoom.getCurrentPlayer();
        }
    }
}
