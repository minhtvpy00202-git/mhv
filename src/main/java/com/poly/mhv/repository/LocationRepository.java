package com.poly.mhv.repository;

import com.poly.mhv.entity.Location;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LocationRepository extends JpaRepository<Location, Integer> {
    List<Location> findByRoomNameContainingIgnoreCase(String roomName);
    Optional<Location> findFirstByRoomNameIgnoreCase(String roomName);
    boolean existsByRoomNameIgnoreCase(String roomName);
    boolean existsByRoomNameIgnoreCaseAndIdNot(String roomName, Integer id);
    long countByFloorId(Integer floorId);

    List<Location> findByHasAssetTrueOrderByRoomNameAsc();

    @Query("""
            select l from Location l
            left join fetch l.floor f
            where (coalesce(:keyword, '') = '' or lower(l.roomName) like lower(concat('%', :keyword, '%')))
              and (:hasAsset is null or coalesce(l.hasAsset, true) = :hasAsset)
            order by case when f.sortOrder is null then 1 else 0 end, f.sortOrder asc, l.roomName asc
            """)
    List<Location> searchByKeyword(@Param("keyword") String keyword, @Param("hasAsset") Boolean hasAsset);

    @Modifying
    @Query("update Location l set l.hasAsset = true where l.hasAsset is null")
    int fillMissingHasAssetWithTrue();
}
