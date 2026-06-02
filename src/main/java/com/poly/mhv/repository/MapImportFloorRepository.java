package com.poly.mhv.repository;

import com.poly.mhv.entity.MapImportFloor;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MapImportFloorRepository extends JpaRepository<MapImportFloor, Long> {

    @EntityGraph(attributePaths = {"suggestions"})
    List<MapImportFloor> findByJobIdOrderBySortOrderAscIdAsc(Long jobId);

    @EntityGraph(attributePaths = {"job", "suggestions"})
    Optional<MapImportFloor> findByIdAndJobId(Long id, Long jobId);
}
