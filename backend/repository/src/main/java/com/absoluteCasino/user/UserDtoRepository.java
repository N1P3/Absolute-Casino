package com.absoluteCasino.user;

import com.absoluteCasino.games.user.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class UserDtoRepository {

    @Autowired
    private UserRepository userRepository;

    public void save(UserDto userDto) {
        userRepository.save(UserMapper.toUser(userDto));
    }

    public Optional<UserDto> findByLogin(String login){
        Optional<User> user = userRepository.findByLogin(login);
        return user.map(UserMapper::toUserDto);
    }

    public Optional<UserDto> findByEmail(String email){
        Optional<User> user = userRepository.findByEmail(email);
        return user.map(UserMapper::toUserDto);
    }

    public Optional<UserDto> findById(Integer id){
        Optional<User> user = userRepository.findById(id);
        return user.map(UserMapper::toUserDto);
    }

}
