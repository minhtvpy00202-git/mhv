package com.poly.mhv.repository;

import com.poly.mhv.entity.InventoryAudit;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventoryAuditRepository extends JpaRepository<InventoryAudit, Integer> {
    @Query("""
            select ia from InventoryAudit ia
            join fetch ia.location l
            join fetch ia.createdBy u
            where (:status is null or ia.status = :status)
            order by ia.startedAt desc, ia.id desc
            """)
    List<InventoryAudit> findForAdmin(@Param("status") String status);

    @Query("""
            select ia from InventoryAudit ia
            join fetch ia.location l
            join fetch ia.createdBy u
            where ia.id = :id
            """)
    Optional<InventoryAudit> findDetailById(@Param("id") Integer id);

    @Query("""
            select ia from InventoryAudit ia
            join fetch ia.location l
            join fetch ia.createdBy u
            where u.id = :createdById
            order by ia.startedAt desc, ia.id desc
            """)
    List<InventoryAudit> findByCreatedByIdForHistory(@Param("createdById") Integer createdById);

    boolean existsByLocationIdAndStatus(Integer locationId, String status);
}
