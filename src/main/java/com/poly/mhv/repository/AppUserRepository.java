package com.poly.mhv.repository;

import com.poly.mhv.entity.AppUser;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUser, Integer> {
    Optional<AppUser> findByUsername(String username);
    List<AppUser> findByRole(String role);
    List<AppUser> findAllByOrderByUsernameAsc();
}
