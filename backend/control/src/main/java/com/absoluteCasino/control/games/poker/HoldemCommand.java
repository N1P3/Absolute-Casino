package com.absoluteCasino.control.games.poker;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class HoldemCommand {
    private String command;   // "join_table", "start_hand", "call", "bet", "raise", "fold", "check", "leave_table"
    private Integer tableId;
    private Long amount;      // używane dla bet/raise
}
