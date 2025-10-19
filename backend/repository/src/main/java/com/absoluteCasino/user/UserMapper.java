package com.absoluteCasino.user;

import com.absoluteCasino.games.user.User;
import com.absoluteCasino.games.utilEntities.FinancialValue;

public class UserMapper {

    public static User toUser(UserDto userDto) {
        User user = new User();
        user.setId(userDto.getId());
        user.setPassword(userDto.getPassword());
        user.setLogin(userDto.getLogin());
        user.setEmail(userDto.getEmail());
        user.setFirstName(userDto.getFirstName());
        user.setLastName(userDto.getLastName());
        user.setBalance(userDto.getBalance() == null ? new FinancialValue(0) : FinancialValue.basedOnGrosze(userDto.getBalance()));
        return user;
    }

    public static UserDto toUserDto(User user) {
        return new UserDto(user.getId(), user.getLogin(), user.getPassword(), user.getFirstName(), user.getLastName(), user.getEmail(), user.getBalance().getValue().asGrosze());
    }

}
