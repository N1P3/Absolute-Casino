package com.absoluteCasino.api;

import com.absoluteCasino.games.SlotRepository;
import com.absoluteCasino.games.slots.SlotWithProgressiveJackpot;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api")
public class SlotsController {

    @Autowired
    private SlotRepository slotRepository;

    @GetMapping("/slots/mummy")
    public String giveMummyLines() {

        return "";

    }

    @PostMapping("/slots/add")
    public String addSlotToDB(@RequestBody SlotWithProgressiveJackpot slotWithProgressiveJackpot){
        slotRepository.save(slotWithProgressiveJackpot);
        return "Pomyślnie dodano slotsa";
    }

}


