"""
MakaoGame - Pure game logic ported 1:1 from Java MakaoGame.java
This contains ALL game rules in one place for AI training.
"""

from typing import List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class PlayResult:
    """Result of a game operation"""
    success: bool
    error_message: Optional[str] = None
    
    @staticmethod
    def ok():
        return PlayResult(success=True)
    
    @staticmethod
    def error(message: str):
        return PlayResult(success=False, error_message=message)


class MakaoGame:
    """
    Core game logic for Makao card game.
    Ported directly from Java MakaoGame.java to ensure identical rules.
    """
    
    def __init__(self):
        self.table_card: Optional[str] = None
        self.current_suit: Optional[str] = None
        self.required_number: Optional[str] = None
        self.pending_draw_count: int = 0
        self.draw_type: Optional[str] = None  # '2', '3', 'K'
        self.pending_skip_turns: int = 0
        self.requirement_turns_left: int = 0
        self.player_to_skip: Optional[int] = None
    
    def can_play_card(self, card: str, table_card: str, active_suit: Optional[str], current_player_id: int) -> bool:
        """
        Checks if a card can be played on the current table card according to rules:
        - If player has playerToSkip and pendingSkipTurns>0 -> can only play 4
        - If active draw (pendingDrawCount>0) -> can only play stacking card (2,3,K♥/♠)
        - If required number (requiredNumber) -> must play card of that number
        - If required suit (currentSuit) -> must play card of that suit or Ace
        - Otherwise standard: card of same value or same suit as table; Ace always possible
        """
        if not card or len(card) < 2 or not table_card or len(table_card) < 2:
            return False
        
        card_value = card[0]
        card_suit = card[1]
        table_value = table_card[0]
        table_suit = table_card[1]
        
        # Skip Turn Logic - must have pending skips active
        if (self.pending_skip_turns > 0 and 
            self.player_to_skip is not None and 
            self.player_to_skip == current_player_id):
            return card_value == '4'
        
        # Draw Stack Logic
        if self.pending_draw_count > 0:
            if self.draw_type == '2':
                return card_value == '2'
            elif self.draw_type == '3':
                return card_value == '3'
            elif self.draw_type == 'K':
                return card_value == 'K' and (card_suit == 'H' or card_suit == 'S')
            return False
        
        # Required Number (Jack effect)
        if self.required_number is not None:
            return card_value == self.required_number
        
        # Required Suit (Ace effect)
        if active_suit is not None and active_suit:
            return card_suit == active_suit[0] or card_value == 'A'
        
        # Ace can always be played
        if card_value == 'A':
            return True
        
        # Jack can be played on same suit or on another Jack
        if card_value == 'J':
            return card_suit == table_suit or card_value == table_value
        
        # Standard: same value or same suit
        return card_value == table_value or card_suit == table_suit
    
    def play_cards(self, cards_to_play: List[str], chosen_suit: Optional[str], 
                   chosen_number: Optional[str], current_player_id: int, 
                   next_player_id: int) -> PlayResult:
        """
        Main method for executing a play - playing cards
        
        Args:
            cards_to_play: List of cards to play (must be same rank)
            chosen_suit: Chosen suit after Ace
            chosen_number: Chosen number after Jack
            current_player_id: ID of current player
            next_player_id: ID of next player (for setting playerToSkip with 4)
            
        Returns:
            PlayResult indicating success or error
        """
        if not cards_to_play:
            return PlayResult.error("Nie wybrano kart")
        
        # Validate same rank if multiple
        if len(cards_to_play) > 1:
            first_rank = cards_to_play[0][0]
            for card in cards_to_play:
                if card[0] != first_rank:
                    return PlayResult.error("Karty muszą być tej samej wartości")
        
        # Check if at least one card can be played on table
        can_play = False
        for card in cards_to_play:
            if self.can_play_card(card, self.table_card, self.current_suit, current_player_id):
                can_play = True
                break
        
        if not can_play:
            return PlayResult.error("Nie możesz zagrać tych kart")
        
        # Process each card
        for card in cards_to_play:
            self.table_card = card
            value = card[0]
            suit = card[1]
            
            # Handle card effects
            if value == 'A':
                if not chosen_suit:
                    return PlayResult.error("Musisz wybrać kolor po Asie")
                self.current_suit = chosen_suit
                self.required_number = None
                self.requirement_turns_left = 2
                
            elif value == 'J':
                if not chosen_number:
                    return PlayResult.error("Musisz wybrać liczbę po Walecie")
                num = chosen_number[0]
                if not (num in '56789' or num == 'T'):
                    return PlayResult.error("Nieprawidłowa liczba (5-10)")
                self.required_number = num
                self.current_suit = None
                self.requirement_turns_left = 2
                
            else:
                # Decrement requirements
                if self.requirement_turns_left > 0:
                    self.requirement_turns_left -= 1
                    if self.requirement_turns_left == 0:
                        self.current_suit = None
                        self.required_number = None
            
            # Apply stacking logic
            if value == '2':
                if self.pending_draw_count == 0:
                    self.draw_type = '2'
                self.pending_draw_count += 2
                
            elif value == '3':
                if self.pending_draw_count == 0:
                    self.draw_type = '3'
                self.pending_draw_count += 3
                
            elif value == '4':
                if (self.player_to_skip is not None and 
                    self.player_to_skip == current_player_id and 
                    self.pending_skip_turns > 0):
                    # Counter - pass back to opponent
                    self.player_to_skip = next_player_id
                    self.pending_skip_turns += 1
                else:
                    # New skip penalty
                    self.player_to_skip = next_player_id
                    self.pending_skip_turns += 1
                    
            elif value == 'K' and (suit == 'H' or suit == 'S'):
                if self.pending_draw_count == 0:
                    self.draw_type = 'K'
                self.pending_draw_count += 5
                
            else:
                # Non-special card clears draw stack
                if self.pending_draw_count > 0:
                    self.pending_draw_count = 0
                    self.draw_type = None
        
        return PlayResult.ok()
    
    def draw_cards(self) -> int:
        """
        Executes drawing cards
        
        Returns:
            Number of cards to draw
        """
        # Decrement requirements
        if self.requirement_turns_left > 0:
            self.requirement_turns_left -= 1
            if self.requirement_turns_left == 0:
                self.current_suit = None
                self.required_number = None
        
        to_draw = self.pending_draw_count if self.pending_draw_count > 0 else 1
        
        if self.pending_draw_count > 0:
            self.pending_draw_count = 0
            self.draw_type = None
        
        return to_draw
    
    def skip_turn(self, player_id: int) -> PlayResult:
        """
        Executes skipping turn
        
        Args:
            player_id: ID of player skipping
            
        Returns:
            PlayResult indicating success or error
        """
        if (self.player_to_skip is None or 
            self.player_to_skip != player_id or 
            self.pending_skip_turns <= 0):
            return PlayResult.error("Nie musisz pomijać tury")
        
        # Decrement requirements
        if self.requirement_turns_left > 0:
            self.requirement_turns_left -= 1
            if self.requirement_turns_left == 0:
                self.current_suit = None
                self.required_number = None
        
        self.pending_skip_turns -= 1
        if self.pending_skip_turns <= 0:
            self.player_to_skip = None
            self.pending_skip_turns = 0
        
        return PlayResult.ok()
    
    def reset(self):
        """Reset game state"""
        self.table_card = None
        self.current_suit = None
        self.required_number = None
        self.pending_draw_count = 0
        self.draw_type = None
        self.pending_skip_turns = 0
        self.requirement_turns_left = 0
        self.player_to_skip = None
