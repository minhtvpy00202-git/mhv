package com.poly.mhv.repository;

import com.poly.mhv.entity.ConsumableRequest;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConsumableRequestRepository extends JpaRepository<ConsumableRequest, Long> {

    @EntityGraph(attributePaths = {"asset", "location", "requestedBy", "resolvedBy"})
    List<ConsumableRequest> findByLocationIdOrderByCreatedAtDescIdDesc(Integer locationId);

    @EntityGraph(attributePaths = {"asset", "location", "requestedBy", "resolvedBy"})
    @Query("""
            select request from ConsumableRequest request
            join request.location location
            where lower(trim(location.roomName)) <> 'kho'
            order by request.createdAt desc, request.id desc
            """)
    List<ConsumableRequest> findAllTrackableRoomRequestsOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"asset", "location", "requestedBy", "resolvedBy"})
    List<ConsumableRequest> findByStatusOrderByCreatedAtDescIdDesc(String status);

    @EntityGraph(attributePaths = {"asset", "location", "requestedBy", "resolvedBy"})
    List<ConsumableRequest> findAllByOrderByCreatedAtDescIdDesc();

    @Query("""
            select count(request)
            from ConsumableRequest request
            join request.asset a
            where request.status = :status
              and (:categoryId is null or a.category.id = :categoryId)
              and (:locationId is null or request.location.id = :locationId)
            """)
    long countByStatusForStatistics(
            @Param("status") String status,
            @Param("categoryId") Integer categoryId,
            @Param("locationId") Integer locationId
    );
}
