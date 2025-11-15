package com.absoluteCasino.control.user;

import com.absoluteCasino.games.user.UserDetailsResponse;
import com.absoluteCasino.user.UserDto;
import com.absoluteCasino.user.UserDtoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserController {

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    UserDtoRepository userDtoRepository;

    public String registerUser(UserDto user) {
        UserValidator userValidator = new UserValidator(userDtoRepository);
        userValidator.validateRegister(user);
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        userDtoRepository.save(user);
        return "Rejestracja udana!";
    }

    public UserDetailsResponse getUserDetails(Authentication authentication) {

        String login = authentication.getName();
        UserDto user;
        try {
            user = userDtoRepository.findByLogin(login).get();
        } catch (Exception e) {
            return null;
        }

        return new UserDetailsResponse(user.getId(), user.getFirstName(), user.getBalance());
    }

    public UserDto getUser(Authentication authentication) {
        try {
            return userDtoRepository.findByLogin(authentication.getName()).get();
        } catch (Exception e) {
            return null;
        }
    }

}
