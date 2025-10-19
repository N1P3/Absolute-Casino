package com.absoluteCasino.control.user;

import com.absoluteCasino.control.exceptions.FailedRegisterException;
import com.absoluteCasino.user.UserDto;
import com.absoluteCasino.user.UserDtoRepository;

public class UserValidator {

    UserDtoRepository userDtoRepository;

    public UserValidator(UserDtoRepository userDtoRepository) {
        this.userDtoRepository = userDtoRepository;
    }

    public void validateRegister(UserDto user){
        if (user.getFirstName() == null || user.getLastName() == null || user.getPassword() == null || user.getEmail() == null) {
            throw new FailedRegisterException("Uzupełnij wszystkie pola");
        }
        if(userDtoRepository.findByLogin(user.getLogin()).isPresent()){
            throw new FailedRegisterException("Login jest już w użyciu");
        } else if (userDtoRepository.findByEmail(user.getEmail()).isPresent()) {
            throw new FailedRegisterException("E-mail jest już w użyciu");
        } else if (!user.getPassword().matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\W_]).{8,}$")){
            throw new FailedRegisterException("Hasło nie spełnia wymagań, użyj co najmniej 8 znaków, w tym jedną wielką literę, jedną cyfrę oraz jeden znak specjalny");
        }
    }

}
