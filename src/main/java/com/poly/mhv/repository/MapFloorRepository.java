package com.poly.mhv.repository;

import com.poly.mhv.entity.MapFloor;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MapFloorRepository extends JpaRepository<MapFloor, Integer> {
    boolean existsByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);
    List<MapFloor> findAllByOrderBySortOrderAscIdAsc();
}
