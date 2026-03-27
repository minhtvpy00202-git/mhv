package com.poly.mhv.repository;

import com.poly.mhv.entity.Location;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LocationRepository extends JpaRepository<Location, Integer> {
    List<Location> findByRoomNameContainingIgnoreCase(String roomName);
}
