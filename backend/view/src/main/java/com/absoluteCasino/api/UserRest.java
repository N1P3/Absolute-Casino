package com.absoluteCasino.api;

import com.absoluteCasino.control.user.UserController;
import com.absoluteCasino.games.user.User;
import com.absoluteCasino.games.user.UserDetailsResponse;
import com.absoluteCasino.games.user.UserTransaction;
import com.absoluteCasino.games.utilEntities.FinancialValue;
import com.absoluteCasino.user.UserDto;
import com.absoluteCasino.user.UserDtoRepository;
import com.absoluteCasino.user.UserRepository;
import com.absoluteCasino.user.UserTransactionsRepository;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.logging.Logger;

@RestController
@RequestMapping("/api")
@Log
public class UserRest {

    @Autowired
    UserController userController;

    @Autowired
    UserRepository userRepository;

    @Autowired
    UserDtoRepository userDtoRepository;

    @Autowired
    UserTransactionsRepository userTransactionsRepository;

    @PostMapping("/register")
    public ResponseEntity<String> registerUser(@RequestBody UserDto user) {
        try {
            userController.registerUser(user);
            return ResponseEntity.ok("Pomyślna rejestracja!");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(e.getMessage());
        }
    }

    @GetMapping("/details")
    public UserDetailsResponse getUserDetails(Authentication authentication) {
        return userController.getUserDetails(authentication);
    }

    @Transactional
    @GetMapping("/deposit")
    public ResponseEntity<String> depositUser(@RequestParam("deposit") int deposit, Authentication authentication) {
        try {
            UserDto user = getUser(authentication);
            User userEntity = userRepository.findById(user.getId()).orElseThrow();
            if (deposit <= 0) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("Deposit amount must be greater than zero.");
            }
            userEntity.setBalance(FinancialValue.basedOnGrosze(user.getBalance() + deposit));
            UserTransaction userTransaction = new UserTransaction();
            userTransaction.setAmount(deposit);

            userEntity.getTransactions().add(userTransaction);
            userTransaction.setUser(userEntity);
            userTransactionsRepository.save(userTransaction);
            userRepository.save(userEntity);
            return ResponseEntity.ok("Deposit successful. New balance: " + user.getBalance() + " PLN");
        } catch (Exception e) {
            Logger.getLogger("test").warning(e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("An error occurred while processing your deposit: " + e.getMessage());
        }
    }

    public UserDto getUser(Authentication authentication){
        return userController.getUser(authentication);
    }


}

