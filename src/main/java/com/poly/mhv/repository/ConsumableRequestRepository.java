package com.poly.mhv.repository;

import com.poly.mhv.entity.ConsumableRequest;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsumableRequestRepository extends JpaRepository<ConsumableRequest, Long> {

    @EntityGraph(attributePaths = {"asset", "location", "requestedBy", "resolvedBy"})
    List<ConsumableRequest> findByLocationIdOrderByCreatedAtDescIdDesc(Integer locationId);

    @EntityGraph(attributePaths = {"asset", "location", "requestedBy", "resolvedBy"})
    List<ConsumableRequest> findByStatusOrderByCreatedAtDescIdDesc(String status);

    @EntityGraph(attributePaths = {"asset", "location", "requestedBy", "resolvedBy"})
    List<ConsumableRequest> findAllByOrderByCreatedAtDescIdDesc();
}
