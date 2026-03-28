package com.poly.mhv.repository;

import com.poly.mhv.entity.MaintenanceRequest;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MaintenanceRequestRepository extends JpaRepository<MaintenanceRequest, Integer> {
    List<MaintenanceRequest> findByAssetQaCode(String assetQaCode);
    List<MaintenanceRequest> findByStatus(String status);
    List<MaintenanceRequest> findByReportedById(Integer reportedById);
    @Query("""
            select mr from MaintenanceRequest mr
            join fetch mr.asset a
            join fetch a.location l
            join fetch a.homeLocation hl
            join fetch mr.reportedBy rb
            where rb.id = :reportedById
            order by mr.reportTime desc, mr.id desc
            """)
    List<MaintenanceRequest> findHistoryByReportedById(@Param("reportedById") Integer reportedById);

    @Query("""
            select mr from MaintenanceRequest mr
            join fetch mr.asset a
            join fetch a.location l
            join fetch a.homeLocation hl
            join fetch mr.reportedBy rb
            order by mr.reportTime desc, mr.id desc
            """)
    List<MaintenanceRequest> findAllForAdminHistory();

    @Query("""
            select mr.asset.qaCode, mr.asset.name, mr.asset.homeLocation.roomName, count(mr)
            from MaintenanceRequest mr
            where mr.reportTime >= :start and mr.reportTime <= :end
            group by mr.asset.qaCode, mr.asset.name, mr.asset.homeLocation.roomName
            order by count(mr) desc
            """)
    List<Object[]> getMaintenanceStatsInPeriod(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );
}
