"""
Tests for MakaoGame - Ported from Java MakaoGameTest.java
Ensures Python implementation matches Java rules exactly.
"""

import unittest
from makao_game import MakaoGame, PlayResult


class TestMakaoGame(unittest.TestCase):
    
    def setUp(self):
        self.game = MakaoGame()
        self.game.table_card = "5H"  # Default table card for tests
    
    def test_can_play_card_same_value(self):
        """Można zagrać kartę o tej samej wartości"""
        self.assertTrue(self.game.can_play_card("2H", "2D", None, 1))
        self.assertTrue(self.game.can_play_card("KS", "KC", None, 1))
    
    def test_can_play_card_same_suit(self):
        """Można zagrać kartę o tym samym kolorze"""
        self.assertTrue(self.game.can_play_card("2H", "5H", None, 1))
        self.assertTrue(self.game.can_play_card("KS", "2S", None, 1))
    
    def test_ace_can_always_be_played(self):
        """As można zawsze zagrać"""
        self.assertTrue(self.game.can_play_card("AH", "2D", None, 1))
        self.assertTrue(self.game.can_play_card("AS", "KH", None, 1))
    
    def test_ace_with_suit_requirement(self):
        """Po zagraniu Asa, wymagany jest określony kolor"""
        self.game.current_suit = "H"
        self.assertTrue(self.game.can_play_card("5H", "AD", "H", 1))
        self.assertFalse(self.game.can_play_card("5D", "AD", "H", 1))
        # As nadal można zagrać
        self.assertTrue(self.game.can_play_card("AS", "AD", "H", 1))
    
    def test_jack_number_requirement(self):
        """Po zagraniu Waleta, wymagana jest określona liczba"""
        self.game.required_number = '7'
        self.assertTrue(self.game.can_play_card("7D", "JH", None, 1))
        self.assertTrue(self.game.can_play_card("7S", "JH", None, 1))
        self.assertFalse(self.game.can_play_card("8D", "JH", None, 1))
    
    def test_jack_can_be_played_on_same_suit_or_jack(self):
        """Walet pasuje do koloru lub do innego Waleta"""
        self.assertTrue(self.game.can_play_card("JH", "5H", None, 1))  # Ten sam kolor
        self.assertTrue(self.game.can_play_card("JD", "JS", None, 1))  # Walet na Waleta
        self.assertFalse(self.game.can_play_card("JH", "5S", None, 1))  # Różny kolor
    
    def test_draw_stacking_with_2(self):
        """Stackowanie 2"""
        self.game.draw_type = "2"
        self.game.pending_draw_count = 2
        self.assertTrue(self.game.can_play_card("2D", "2H", None, 1))
        self.assertFalse(self.game.can_play_card("3D", "2H", None, 1))
        self.assertFalse(self.game.can_play_card("5D", "2H", None, 1))
    
    def test_draw_stacking_with_3(self):
        """Stackowanie 3"""
        self.game.draw_type = "3"
        self.game.pending_draw_count = 3
        self.assertTrue(self.game.can_play_card("3S", "3H", None, 1))
        self.assertFalse(self.game.can_play_card("2S", "3H", None, 1))
    
    def test_draw_stacking_with_king_heart_spade(self):
        """Stackowanie K♥/♠"""
        self.game.draw_type = "K"
        self.game.pending_draw_count = 5
        self.assertTrue(self.game.can_play_card("KH", "KS", None, 1))
        self.assertTrue(self.game.can_play_card("KS", "KH", None, 1))
        self.assertFalse(self.game.can_play_card("KD", "KH", None, 1))  # K♦ nie stackuje
        self.assertFalse(self.game.can_play_card("KC", "KH", None, 1))  # K♣ nie stackuje
    
    def test_skip_turn_with_4(self):
        """Gdy gracz ma skip, może zagrać tylko 4"""
        self.game.player_to_skip = 1
        self.game.pending_skip_turns = 1
        self.assertTrue(self.game.can_play_card("4H", "5H", None, 1))
        self.assertFalse(self.game.can_play_card("5H", "5D", None, 1))  # Normalna karta niedozwolona
    
    def test_skip_turn_requires_pending_skips(self):
        """Skip działa tylko gdy pendingSkipTurns > 0"""
        self.game.player_to_skip = 1
        self.game.pending_skip_turns = 0  # Brak aktywnych skipów
        # Gracz może zagrać normalnie
        self.assertTrue(self.game.can_play_card("5H", "5D", None, 1))
    
    def test_play_cards_with_ace(self):
        """Zagranie Asa wymaga wyboru koloru"""
        cards = ["AH"]
        result = self.game.play_cards(cards, "D", None, 1, 2)
        self.assertTrue(result.success)
        self.assertEqual("D", self.game.current_suit)
        self.assertEqual(2, self.game.requirement_turns_left)
    
    def test_play_cards_with_jack(self):
        """Zagranie Waleta wymaga wyboru liczby"""
        cards = ["JH"]
        result = self.game.play_cards(cards, None, "7", 1, 2)
        self.assertTrue(result.success)
        self.assertEqual('7', self.game.required_number)
        self.assertEqual(2, self.game.requirement_turns_left)
    
    def test_play_cards_with_multiple_same_rank(self):
        """Zagranie wielu kart tej samej wartości"""
        self.game.table_card = "5H"
        cards = ["5D", "5S"]
        result = self.game.play_cards(cards, None, None, 1, 2)
        self.assertTrue(result.success)
        self.assertEqual("5S", self.game.table_card)  # Ostatnia karta na stole
    
    def test_play_cards_different_ranks_fails(self):
        """Zagranie kart różnych wartości powinno zawieść"""
        cards = ["5D", "6S"]
        result = self.game.play_cards(cards, None, None, 1, 2)
        self.assertFalse(result.success)
        self.assertEqual("Karty muszą być tej samej wartości", result.error_message)
    
    def test_play_cards_4_counter(self):
        """Zagranie 4 jako counter"""
        self.game.player_to_skip = 1
        self.game.pending_skip_turns = 1
        self.game.table_card = "4H"
        cards = ["4D"]
        result = self.game.play_cards(cards, None, None, 1, 2)
        self.assertTrue(result.success)
        self.assertEqual(2, self.game.player_to_skip)  # Przekazano na gracza 2
        self.assertEqual(2, self.game.pending_skip_turns)  # Zwiększono o 1
    
    def test_draw_cards(self):
        """Dobieranie bez stacka"""
        to_draw = self.game.draw_cards()
        self.assertEqual(1, to_draw)
        
        # Dobieranie ze stackiem
        self.game.pending_draw_count = 5
        self.game.draw_type = "2"
        to_draw = self.game.draw_cards()
        self.assertEqual(5, to_draw)
        self.assertEqual(0, self.game.pending_draw_count)  # Stack wyczyszczony
        self.assertIsNone(self.game.draw_type)
    
    def test_skip_turn_success(self):
        """Pomijanie tury gdy jest wymagane"""
        self.game.player_to_skip = 1
        self.game.pending_skip_turns = 2
        result = self.game.skip_turn(1)
        self.assertTrue(result.success)
        self.assertEqual(1, self.game.pending_skip_turns)  # Zmniejszono o 1
    
    def test_skip_turn_clears_when_zero(self):
        """Pomijanie ostatniej tury czyści penalty"""
        self.game.player_to_skip = 1
        self.game.pending_skip_turns = 1
        result = self.game.skip_turn(1)
        self.assertTrue(result.success)
        self.assertIsNone(self.game.player_to_skip)
        self.assertEqual(0, self.game.pending_skip_turns)
    
    def test_skip_turn_fails_when_not_required(self):
        """Próba pomijania gdy nie jest wymagane"""
        result = self.game.skip_turn(1)
        self.assertFalse(result.success)
        self.assertEqual("Nie musisz pomijać tury", result.error_message)
    
    def test_requirement_turns_decrement(self):
        """Wymagania (Ace/Jack) trwają 2 tury"""
        self.game.current_suit = "H"
        self.game.requirement_turns_left = 2
        
        # Po zagraniu normalnej karty, licznik spada
        cards = ["5H"]
        self.game.play_cards(cards, None, None, 1, 2)
        self.assertEqual(1, self.game.requirement_turns_left)
        
        # Po kolejnej turze, wymaganie znika
        cards = ["6H"]
        self.game.play_cards(cards, None, None, 1, 2)
        self.assertEqual(0, self.game.requirement_turns_left)
        self.assertIsNone(self.game.current_suit)


if __name__ == '__main__':
    unittest.main()
