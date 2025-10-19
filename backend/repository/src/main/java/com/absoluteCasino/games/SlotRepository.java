package com.absoluteCasino.games;

import com.absoluteCasino.games.slots.SlotWithProgressiveJackpot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SlotRepository extends JpaRepository<SlotWithProgressiveJackpot, Integer> {

    Optional<SlotWithProgressiveJackpot> findById(Integer id);



}
