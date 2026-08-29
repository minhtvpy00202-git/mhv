package com.poly.mhv.repository;

import com.poly.mhv.entity.ServiceInquiry;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;
import java.util.Collection;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ServiceInquiryRepository extends JpaRepository<ServiceInquiry, Long> {

    @EntityGraph(attributePaths = {"requester", "assignee", "asset", "asset.category", "asset.location", "asset.homeLocation", "destinationLocation", "alternativeAsset"})
    List<ServiceInquiry> findByRequesterIdOrderByUpdatedAtDesc(Integer requesterId);

    @EntityGraph(attributePaths = {"requester", "assignee", "asset", "asset.category", "asset.location", "asset.homeLocation", "destinationLocation", "alternativeAsset"})
    @Query("""
            select i from ServiceInquiry i
            where i.targetRole = :targetRole
              and (:status is null or i.status = :status)
            order by i.updatedAt desc, i.id desc
            """)
    List<ServiceInquiry> findInbox(@Param("targetRole") String targetRole, @Param("status") String status);

    @EntityGraph(attributePaths = {"requester", "assignee", "asset", "asset.category", "asset.location", "asset.homeLocation", "destinationLocation", "alternativeAsset"})
    @Query("""
            select i from ServiceInquiry i
            where (i.targetRole = 'Admin' or i.status = 'WAITING_APPROVAL')
              and (:status is null or i.status = :status)
            order by i.updatedAt desc, i.id desc
            """)
    List<ServiceInquiry> findAdminInbox(@Param("status") String status);

    @EntityGraph(attributePaths = {"requester", "assignee", "asset", "asset.category", "asset.location", "asset.homeLocation", "destinationLocation", "alternativeAsset"})
    @Query("select i from ServiceInquiry i where i.id = :id")
    Optional<ServiceInquiry> findDetailById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"requester", "assignee", "asset", "destinationLocation", "alternativeAsset"})
    @Query("select i from ServiceInquiry i where i.id = :id")
    Optional<ServiceInquiry> findForUpdateById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"requester", "assignee", "asset", "destinationLocation", "alternativeAsset"})
    Optional<ServiceInquiry> findByLinkedEntityTypeAndLinkedEntityId(String linkedEntityType, Long linkedEntityId);

    @EntityGraph(attributePaths = {"requester", "assignee", "asset", "destinationLocation"})
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select i from ServiceInquiry i
            where i.firstResponseAt is null
              and i.slaResponseDueAt is not null
              and i.slaResponseDueAt <= :now
              and i.status not in :terminalStatuses
            order by i.slaResponseDueAt asc
            """)
    List<ServiceInquiry> findResponseSlaOverdue(
            @Param("now") LocalDateTime now,
            @Param("terminalStatuses") Collection<String> terminalStatuses);

    @EntityGraph(attributePaths = {"requester", "assignee", "asset", "alternativeAsset", "destinationLocation"})
    @Query("""
            select i from ServiceInquiry i
            where i.createdAt >= :fromDateTime
              and i.createdAt < :toDateTime
              and (:targetRole is null or i.targetRole = :targetRole)
            order by i.createdAt desc
            """)
    List<ServiceInquiry> findForReport(
            @Param("fromDateTime") LocalDateTime fromDateTime,
            @Param("toDateTime") LocalDateTime toDateTime,
            @Param("targetRole") String targetRole);
}
