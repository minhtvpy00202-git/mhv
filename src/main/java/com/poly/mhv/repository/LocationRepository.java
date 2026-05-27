package com.poly.mhv.repository;

import com.poly.mhv.entity.Location;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LocationRepository extends JpaRepository<Location, Integer> {
    List<Location> findByRoomNameContainingIgnoreCase(String roomName);
    Optional<Location> findFirstByRoomNameIgnoreCase(String roomName);
    boolean existsByRoomNameIgnoreCase(String roomName);
    boolean existsByRoomNameIgnoreCaseAndIdNot(String roomName, Integer id);

    @Query("""
            select l from Location l
            where (coalesce(:keyword, '') = '' or lower(l.roomName) like lower(concat('%', :keyword, '%')))
            order by l.roomName asc
            """)
    List<Location> searchByKeyword(@Param("keyword") String keyword);
}
