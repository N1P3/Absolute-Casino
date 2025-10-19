import com.absoluteCasino.control.exceptions.FailedRegisterException;
import com.absoluteCasino.control.user.UserValidator;
import com.absoluteCasino.user.UserDto;
import com.absoluteCasino.user.UserDtoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class UserValidationTest {

    private UserDtoRepository userDtoRepository;
    private UserValidator userValidator;

    @BeforeEach
    void setUp() {
        userDtoRepository = mock(UserDtoRepository.class);
        userValidator = new UserValidator(userDtoRepository);
    }

    @Test
    void testValidateRegister_whenAllFieldsAreValid() {
        UserDto validUser = new UserDto(1, "login123", "Password123A!", "Doe", "dsad", "john.doe@example.com", (long) 2000.0);

        when(userDtoRepository.findByLogin(any())).thenReturn(java.util.Optional.empty());
        when(userDtoRepository.findByEmail(any())).thenReturn(java.util.Optional.empty());

        try {
            userValidator.validateRegister(validUser);
        } catch (FailedRegisterException e) {
            e.printStackTrace();
            throw new AssertionError("Expected no exception to be thrown");
        }

        verify(userDtoRepository).findByLogin(validUser.getLogin());
        verify(userDtoRepository).findByEmail(validUser.getEmail());
    }

    @Test
    void testValidateRegister_whenLoginAlreadyExists() {
        UserDto userWithExistingLogin = new UserDto(1, "login123", "John", "Doe", "password1A!", "john.doe@example.com", 2000l);

        when(userDtoRepository.findByLogin(any())).thenReturn(java.util.Optional.of(new UserDto()));

        try {
            userValidator.validateRegister(userWithExistingLogin);
        } catch (FailedRegisterException e) {
            assert(e.getMessage().equals("Login jest już w użyciu"));
            return;
        }

        throw new AssertionError("Expected exception to be thrown");
    }

    @Test
    void testValidateRegister_whenEmailAlreadyExists() {
        UserDto userWithExistingEmail = new UserDto(1, "login123", "John", "Doe", "password1A!", "john.doe@example.com", 2l);

        when(userDtoRepository.findByLogin(any())).thenReturn(java.util.Optional.empty());
        when(userDtoRepository.findByEmail(any())).thenReturn(java.util.Optional.of(new UserDto()));

        try {
            userValidator.validateRegister(userWithExistingEmail);
        } catch (FailedRegisterException e) {
            assert(e.getMessage().equals("E-mail jest już w użyciu"));
            return;
        }

        throw new AssertionError("Expected exception to be thrown");
    }

    @Test
    void testValidateRegister_whenPasswordDoesNotMeetRequirements() {
        UserDto userWithInvalidPassword = new UserDto(1, "login123", "John", "Doe", "weakpassword", "john.doe@example.com", 2l);

        when(userDtoRepository.findByLogin(any())).thenReturn(java.util.Optional.empty());
        when(userDtoRepository.findByEmail(any())).thenReturn(java.util.Optional.empty());

        try {
            userValidator.validateRegister(userWithInvalidPassword);
        } catch (FailedRegisterException e) {
            assert(e.getMessage().equals("Hasło nie spełnia wymagań, użyj co najmniej 8 znaków, w tym jedną wielką literę, jedną cyfrę oraz jeden znak specjalny"));
            return;
        }

        throw new AssertionError("Expected exception to be thrown");
    }

    @Test
    void testValidateRegister_whenRequiredFieldsAreNull() {
        UserDto userWithNullFields = new UserDto(null, null, null, null, null, null, null);

        try {
            userValidator.validateRegister(userWithNullFields);
        } catch (FailedRegisterException e) {
            assert(e.getMessage().equals("Uzupełnij wszystkie pola"));
            return;
        }

        throw new AssertionError("Expected exception to be thrown");
    }
}
