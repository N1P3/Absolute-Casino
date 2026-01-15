package com.absoluteCasino.control.games.poker;

import java.util.*;

public class HoldemHandEvaluator {

    private static final Map<Character, Integer> RANKS = createRanks();

    private static Map<Character, Integer> createRanks() {
        Map<Character, Integer> m = new HashMap<>();
        m.put('2', 2);
        m.put('3', 3);
        m.put('4', 4);
        m.put('5', 5);
        m.put('6', 6);
        m.put('7', 7);
        m.put('8', 8);
        m.put('9', 9);
        m.put('T', 10);
        m.put('J', 11);
        m.put('Q', 12);
        m.put('K', 13);
        m.put('A', 14);
        return m;
    }

    public int evaluateHand(List<String> hole, List<String> board) {
        List<String> cards = new ArrayList<>(hole.size() + board.size());
        cards.addAll(hole);
        cards.addAll(board);
        List<int[]> fives = combinations(cards.size());
        int best = Integer.MAX_VALUE;
        for (int[] idx : fives) {
            List<String> five = Arrays.asList(
                    cards.get(idx[0]),
                    cards.get(idx[1]),
                    cards.get(idx[2]),
                    cards.get(idx[3]),
                    cards.get(idx[4])
            );
            int score = score5(five);
            if (score < best) best = score;
        }
        return best;
    }

    private List<int[]> combinations(int n) {
        List<int[]> res = new ArrayList<>();
        for (int a = 0; a < n - 4; a++)
            for (int b = a + 1; b < n - 3; b++)
                for (int c = b + 1; c < n - 2; c++)
                    for (int d = c + 1; d < n - 1; d++)
                        for (int e = d + 1; e < n; e++)
                            res.add(new int[]{a, b, c, d, e});
        return res;
    }

    private int score5(List<String> five) {
        int[] ranks = new int[5];
        char[] suits = new char[5];
        for (int i = 0; i < 5; i++) {
            String c = five.get(i);
            ranks[i] = RANKS.get(c.charAt(0));
            suits[i] = c.charAt(1);
        }
        Arrays.sort(ranks);
        boolean flush = suits[0] == suits[1] && suits[1] == suits[2] && suits[2] == suits[3] && suits[3] == suits[4];
        boolean straight = isStraight(ranks);
        int[] counts = new int[15];
        for (int r : ranks) counts[r]++;
        int four = -1, three = -1;
        List<Integer> pairs = new ArrayList<>();
        for (int r = 14; r >= 2; r--) {
            if (counts[r] == 4) four = r;
            else if (counts[r] == 3) three = r;
            else if (counts[r] == 2) pairs.add(r);
        }
        if (straight && flush) return encode(1, ranks[4], rev(ranks));
        if (four != -1) return encode(2, four, kickersExcludingCount(ranks, four, 1));
        if (three != -1 && !pairs.isEmpty()) return encode(3, three * 100 + pairs.getFirst(), Collections.emptyList());
        if (flush) return encode(4, ranks[4], rev(ranks));
        if (straight) return encode(5, ranks[4], Collections.emptyList());
        if (three != -1) return encode(6, three, kickersExcludingCount(ranks, three, 2));
        if (pairs.size() >= 2) return encode(7, pairs.get(0) * 100 + pairs.get(1), kickersExcludingTwo(ranks, pairs.get(0), pairs.get(1)));
        if (pairs.size() == 1) return encode(8, pairs.get(0), kickersExcludingCount(ranks, pairs.get(0), 1));
        return encode(9, ranks[4], rev(ranks));
    }

    private boolean isStraight(int[] r) {
        int[] a = r.clone();
        if (a[0] == 2 && a[1] == 3 && a[2] == 4 && a[3] == 5 && a[4] == 14) {
            a[4] = 5;
            Arrays.sort(a);
        }
        for (int i = 1; i < 5; i++) if (a[i] != a[i - 1] + 1) return false;
        r[0] = a[0]; r[1] = a[1]; r[2] = a[2]; r[3] = a[3]; r[4] = a[4];
        return true;
    }

    private List<Integer> rev(int[] ranks) {
        List<Integer> list = new ArrayList<>(5);
        for (int i = 4; i >= 0; i--) list.add(ranks[i]);
        return list;
    }

    private List<Integer> kickersExcludingCount(int[] ranks, int value, int count) {
        List<Integer> list = new ArrayList<>();
        int removed = 0;
        for (int i = 4; i >= 0; i--) {
            if (ranks[i] == value && removed < count) {
                removed++;
            } else {
                list.add(ranks[i]);
            }
        }
        return list;
    }

    private List<Integer> kickersExcludingTwo(int[] ranks, int v1, int v2) {
        List<Integer> list = new ArrayList<>();
        for (int i = 4; i >= 0; i--) if (ranks[i] != v1 && ranks[i] != v2) list.add(ranks[i]);
        return list;
    }

    private int encode(int category, int primary, List<Integer> kickers) {
        int score = category * 1_000_000;
        score += (15 - primary) * 5_000;
        int mul = 100;
        for (int i = 0; i < Math.min(3, kickers.size()); i++) {
            score += (15 - kickers.get(i)) * mul;
            mul /= 10;
        }
        return score;
    }

    public String getHandDescription(int score) {
        int category = score / 1_000_000;
        int primary = 15 - (score % 1_000_000) / 5_000;
        
        return switch (category) {
            case 1 -> "Straight Flush, " + getRankNameSingular(primary) + " High";
            case 2 -> "Four of a Kind, " + getRankName(primary);
            case 3 -> "Full House"; 
            case 4 -> "Flush, " + getRankNameSingular(primary) + " High";
            case 5 -> "Straight, " + getRankNameSingular(primary) + " High";
            case 6 -> "Three of a Kind, " + getRankName(primary);
            case 7 -> "Two Pair"; 
            case 8 -> "Pair of " + getRankName(primary);
            case 9 -> "High Card, " + getRankNameSingular(primary);
            default -> "Unknown";
        };
    }

    private String getRankName(int rank) {
        return switch (rank) {
            case 14 -> "Aces";
            case 13 -> "Kings";
            case 12 -> "Queens";
            case 11 -> "Jacks";
            case 10 -> "Tens";
            default -> rank + "s";
        };
    }

    // Singular version for High Card/Straight
    private String getRankNameSingular(int rank) {
        return switch (rank) {
            case 14 -> "Ace";
            case 13 -> "King";
            case 12 -> "Queen";
            case 11 -> "Jack";
            case 10 -> "Ten";
            default -> String.valueOf(rank);
        };
    }
}
