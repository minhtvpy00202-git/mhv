package com.poly.mhv.repository;

import com.poly.mhv.entity.Asset;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssetRepository extends JpaRepository<Asset, String> {
    List<Asset> findByLocationId(Integer locationId);
    @EntityGraph(attributePaths = {"location", "homeLocation"})
    List<Asset> findByHomeLocationId(Integer homeLocationId);
    List<Asset> findByStatus(String status);
    List<Asset> findByQaCodeContainingIgnoreCaseOrNameContainingIgnoreCase(String qaCode, String name);
    List<Asset> findByCategoryId(Integer categoryId);
    long countByHomeLocationId(Integer homeLocationId);
    long countBySupplierId(Integer supplierId);
    long countByCategoryId(Integer categoryId);
    long countByLocationIdOrHomeLocationId(Integer locationId, Integer homeLocationId);
    List<Asset> findByWarrantyExpirationDate(LocalDate warrantyExpirationDate);

    @EntityGraph(attributePaths = {"location", "homeLocation", "category", "supplier"})
    @Query("""
            select a from Asset a
            join a.location l
            left join a.homeLocation hl
            join a.category c
            where (coalesce(:name, '') = '' or lower(a.name) like lower(concat('%', :name, '%')))
              and (:status is null or a.status = :status)
              and (:categoryId is null or c.id = :categoryId)
              and (:locationId is null or l.id = :locationId)
            """)
    Page<Asset> searchForAdmin(
            @Param("name") String name,
            @Param("status") String status,
            @Param("categoryId") Integer categoryId,
            @Param("locationId") Integer locationId,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"location", "homeLocation", "category", "supplier"})
    @Query("select a from Asset a where a.qaCode = :qaCode")
    Optional<Asset> findDetailByQaCode(@Param("qaCode") String qaCode);

    @EntityGraph(attributePaths = {"location", "homeLocation"})
    @Query("select a from Asset a where a.qaCode in :qaCodes")
    List<Asset> findAllDetailsByQaCodeIn(@Param("qaCodes") List<String> qaCodes);

    @Query("""
            select max(a.qaCode) from Asset a
            where a.category.id = :categoryId
              and a.qaCode like concat(:prefix, '%')
            """)
    Optional<String> findMaxQaCodeByCategoryIdAndPrefix(@Param("categoryId") Integer categoryId, @Param("prefix") String prefix);

    @Query("select count(a) from Asset a")
    long countAllAssets();
    @Query("select count(a) from Asset a where a.status = :status")
    long countByStatusValue(@Param("status") String status);
    @Query("select a from Asset a join fetch a.location l join fetch a.category c order by l.id asc, a.qaCode asc")
    List<Asset> findAllForExportOrderByLocation();
}
