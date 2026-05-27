package com.poly.mhv.repository;

import com.poly.mhv.entity.ConsumableLocationStock;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsumableLocationStockRepository extends JpaRepository<ConsumableLocationStock, Long> {

    @EntityGraph(attributePaths = {"asset", "location", "lastUpdatedBy"})
    List<ConsumableLocationStock> findByAssetQaCodeOrderByLocationRoomNameAsc(String assetQaCode);

    @EntityGraph(attributePaths = {"asset", "location", "lastUpdatedBy"})
    List<ConsumableLocationStock> findByLocationIdOrderByAssetNameAsc(Integer locationId);

    @EntityGraph(attributePaths = {"asset", "location", "lastUpdatedBy"})
    Optional<ConsumableLocationStock> findFirstByAssetQaCodeAndLocationId(String assetQaCode, Integer locationId);
}
