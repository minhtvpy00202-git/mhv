package com.poly.mhv.repository;

import com.poly.mhv.entity.MapImportJob;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MapImportJobRepository extends JpaRepository<MapImportJob, Long> {

    @EntityGraph(attributePaths = {"requestedBy"})
    List<MapImportJob> findAllByOrderByRequestedAtDescIdDesc();

    @EntityGraph(attributePaths = {"requestedBy", "floors", "floors.suggestions"})
    Optional<MapImportJob> findWithDetailsById(Long id);
}
