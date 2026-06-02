package com.poly.mhv.repository;

import com.poly.mhv.entity.MapImportSuggestion;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MapImportSuggestionRepository extends JpaRepository<MapImportSuggestion, Long> {

    List<MapImportSuggestion> findByImportFloorJobIdOrderByIdAsc(Long jobId);

    @EntityGraph(attributePaths = {"importFloor", "importFloor.job"})
    Optional<MapImportSuggestion> findByIdAndImportFloorJobId(Long id, Long jobId);
}
