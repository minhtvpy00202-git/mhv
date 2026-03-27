package com.poly.mhv.repository;

import com.poly.mhv.entity.Asset;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssetRepository extends JpaRepository<Asset, String> {
    List<Asset> findByLocationId(Integer locationId);
    List<Asset> findByHomeLocationId(Integer homeLocationId);
    List<Asset> findByStatus(String status);
    List<Asset> findByQaCodeContainingIgnoreCaseOrNameContainingIgnoreCase(String qaCode, String name);
    @Query("""
            select a from Asset a
            join fetch a.location l
            join fetch a.homeLocation hl
            join fetch a.category c
            where (:name is null or lower(a.name) like lower(concat('%', :name, '%')))
              and (:status is null or a.status = :status)
              and (:categoryId is null or c.id = :categoryId)
            order by a.qaCode asc
            """)
    List<Asset> searchForAdmin(
            @Param("name") String name,
            @Param("status") String status,
            @Param("categoryId") Integer categoryId
    );
    @Query("select count(a) from Asset a")
    long countAllAssets();
    @Query("select count(a) from Asset a where a.status = :status")
    long countByStatusValue(@Param("status") String status);
    @Query("select a from Asset a join fetch a.location l join fetch a.category c order by l.id asc, a.qaCode asc")
    List<Asset> findAllForExportOrderByLocation();
}
