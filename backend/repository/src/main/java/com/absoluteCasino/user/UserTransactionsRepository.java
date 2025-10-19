package com.absoluteCasino.user;

import com.absoluteCasino.games.user.UserTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserTransactionsRepository extends JpaRepository<UserTransaction, Integer> {
}