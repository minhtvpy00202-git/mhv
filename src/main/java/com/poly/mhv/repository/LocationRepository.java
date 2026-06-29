package com.poly.mhv.repository;

import com.poly.mhv.entity.Location;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LocationRepository extends JpaRepository<Location, Integer> {
    List<Location> findByRoomNameContainingIgnoreCase(String roomName);
    boolean existsByRoomNameIgnoreCase(String roomName);
    boolean existsByRoomNameIgnoreCaseAndIdNot(String roomName, Integer id);
    long countByFloorId(Integer floorId);
    List<Location> findByFloorIdOrderByRoomNameAsc(Integer floorId);

    long countByAreaTypeKeyIgnoreCase(String areaTypeKey);

    @Query("""
            select l from Location l
            left join fetch l.floor f
            where (coalesce(:keyword, '') = '' or lower(l.roomName) like lower(concat('%', :keyword, '%')))
            order by case when f.sortOrder is null then 1 else 0 end, f.sortOrder asc, l.roomName asc
            """)
    List<Location> searchByKeyword(@Param("keyword") String keyword);

    @Query("""
            select count(location) from Location location
            where not exists (
                select 1
                from AreaTypeCatalog areaType
                where upper(areaType.typeKey) = upper(location.areaTypeKey)
                  and coalesce(areaType.isStorageWarehouse, false) = true
            )
            """)
    long countTrackableConsumableRooms();
}
