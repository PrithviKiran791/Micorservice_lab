package com.resqnet.auth.repository;

import com.resqnet.auth.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** Spring Data generates the implementation of these queries from the method names. */
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);
}
