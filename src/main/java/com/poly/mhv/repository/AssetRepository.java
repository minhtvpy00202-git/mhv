package com.poly.mhv.repository;

import com.poly.mhv.dto.asset.AssetAdminListItemResponse;
import com.poly.mhv.dto.assetmap.AssetMapAssetResponse;
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
    long countByHomeLocationIdAndTrackingMode(Integer homeLocationId, String trackingMode);
    List<Asset> findByHomeLocationIdAndTrackingMode(Integer homeLocationId, String trackingMode);

    @Query("""
            select new com.poly.mhv.dto.asset.AssetAdminListItemResponse(
                a.qaCode,
                a.trackingMode,
                a.name,
                c.id,
                c.name,
                a.status,
            a.technicalStatus,
            a.usageStatus,
                l.id,
                l.roomName,
                hl.id,
                hl.roomName,
                a.purchasePrice,
                a.expiryTrackingEnabled,
                a.expirationDate,
                a.quantityOnHand,
                a.minimumStock,
                a.unit,
                s.id,
                s.name
            )
            from Asset a
            join a.location l
            left join a.homeLocation hl
            join a.category c
            left join a.supplier s
            where (coalesce(:name, '') = '' or lower(a.name) like lower(concat('%', :name, '%')))
              and (
                    :status is null
                    or (
                        a.trackingMode = 'CONSUMABLE'
                        and (
                            (:status = 'Còn hàng' and coalesce(a.quantityOnHand, 0) > coalesce(a.minimumStock, 0))
                            or (:status = 'Cần nhập' and coalesce(a.quantityOnHand, 0) <= coalesce(a.minimumStock, 0))
                        )
                    )
                    or (
                        a.trackingMode <> 'CONSUMABLE'
                    and (
                        (:status = 'Hoạt động tốt'
                            and coalesce(a.technicalStatus, 'Hoạt động tốt') = 'Hoạt động tốt'
                            and coalesce(a.status, '') not in ('Hỏng', 'Bảo trì', 'Thất lạc')
                            and not (
                                coalesce(a.usageStatus, '') = 'Đang cho mượn'
                                or a.status = 'Đang sử dụng'
                                or (hl.id is not null and l.id <> hl.id)
                            )
                            and coalesce(a.status, '') <> 'Bảo trì')
                        or (:status = 'Đang cho mượn'
                            and coalesce(a.technicalStatus, 'Hoạt động tốt') = 'Hoạt động tốt'
                            and coalesce(a.status, '') not in ('Hỏng', 'Bảo trì', 'Thất lạc')
                            and (
                                coalesce(a.usageStatus, '') = 'Đang cho mượn'
                                or a.status = 'Đang sử dụng'
                                or (hl.id is not null and l.id <> hl.id)
                            ))
                        or (:status = 'Hỏng'
                            and (
                                coalesce(a.technicalStatus, 'Hoạt động tốt') = 'Hỏng'
                                or coalesce(a.status, '') = 'Hỏng'
                            )
                            and coalesce(a.status, '') <> 'Bảo trì')
                        or (:status = 'Đang sửa chữa'
                            and coalesce(a.status, '') = 'Bảo trì')
                        or (:status = 'Thất lạc'
                            and (
                                coalesce(a.technicalStatus, 'Hoạt động tốt') = 'Thất lạc'
                                or coalesce(a.status, '') = 'Thất lạc'
                            ))
                    )
                    )
              )
              and (:trackingMode is null or a.trackingMode = :trackingMode)
              and (:categoryId is null or c.id = :categoryId)
              and (:locationId is null or l.id = :locationId)
            """)
    Page<AssetAdminListItemResponse> searchForAdmin(
            @Param("name") String name,
            @Param("status") String status,
            @Param("trackingMode") String trackingMode,
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
            select new com.poly.mhv.dto.assetmap.AssetMapAssetResponse(
                a.qaCode,
                a.name,
                a.trackingMode,
                c.id,
                c.name,
                a.status,
                a.technicalStatus,
                a.usageStatus,
                l.id,
                l.roomName,
                hl.id,
                hl.roomName,
                f.id,
                f.name
            )
            from Asset a
            join a.location l
            left join l.floor f
            left join a.homeLocation hl
            join a.category c
            where (coalesce(:keyword, '') = ''
                or lower(a.qaCode) like lower(concat('%', :keyword, '%'))
                or lower(a.name) like lower(concat('%', :keyword, '%')))
              and (:categoryId is null or c.id = :categoryId)
              and (:locationId is null or l.id = :locationId)
              and (:floorId is null or f.id = :floorId)
              and (:trackingMode is null or a.trackingMode = :trackingMode)
            order by case when f.sortOrder is null then 1 else 0 end, f.sortOrder asc, l.roomName asc, a.qaCode asc
            """)
    List<AssetMapAssetResponse> searchForAssetMap(
            @Param("keyword") String keyword,
            @Param("categoryId") Integer categoryId,
            @Param("locationId") Integer locationId,
            @Param("floorId") Integer floorId,
            @Param("trackingMode") String trackingMode
    );

    @Query("""
            select max(a.qaCode) from Asset a
            where a.category.id = :categoryId
              and a.qaCode like concat(:prefix, '%')
            """)
    Optional<String> findMaxQaCodeByCategoryIdAndPrefix(@Param("categoryId") Integer categoryId, @Param("prefix") String prefix);

    @Query("select count(a) from Asset a where a.trackingMode = 'ITEMIZED'")
    long countAllAssets();

    @Query("select count(a) from Asset a where a.trackingMode = 'CONSUMABLE'")
    long countAllConsumables();

    @Query("""
            select count(a) from Asset a
            where a.trackingMode = 'CONSUMABLE'
              and coalesce(a.quantityOnHand, 0) <= coalesce(a.minimumStock, 0)
            """)
    long countLowStockConsumables();

    @Query("""
            select count(a) from Asset a
            where a.trackingMode = 'ITEMIZED'
              and coalesce(a.technicalStatus, 'Hoạt động tốt') = :technicalStatus
              and coalesce(a.status, '') not in ('Hỏng', 'Bảo trì', 'Thất lạc')
              and (
                    (:usageStatus = 'Tại vị trí gốc' and not (
                        coalesce(a.usageStatus, '') = 'Đang cho mượn'
                        or a.status = 'Đang sử dụng'
                        or (a.homeLocation.id is not null and a.location.id <> a.homeLocation.id)
                    ))
                    or (:usageStatus = 'Đang cho mượn' and (
                        coalesce(a.usageStatus, '') = 'Đang cho mượn'
                        or a.status = 'Đang sử dụng'
                        or (a.homeLocation.id is not null and a.location.id <> a.homeLocation.id)
                    ))
                  )
              and coalesce(a.status, '') <> 'Bảo trì'
            """)
    long countAvailableAssets(
            @Param("technicalStatus") String technicalStatus,
            @Param("usageStatus") String usageStatus
    );

    @Query("""
            select count(a) from Asset a
            where a.trackingMode = 'ITEMIZED'
              and coalesce(a.technicalStatus, 'Hoạt động tốt') = :technicalStatus
              and coalesce(a.status, '') not in ('Hỏng', 'Bảo trì', 'Thất lạc')
              and (
                    (:usageStatus = 'Tại vị trí gốc' and not (
                        coalesce(a.usageStatus, '') = 'Đang cho mượn'
                        or a.status = 'Đang sử dụng'
                        or (a.homeLocation.id is not null and a.location.id <> a.homeLocation.id)
                    ))
                    or (:usageStatus = 'Đang cho mượn' and (
                        coalesce(a.usageStatus, '') = 'Đang cho mượn'
                        or a.status = 'Đang sử dụng'
                        or (a.homeLocation.id is not null and a.location.id <> a.homeLocation.id)
                    ))
                  )
            """)
    long countBorrowedAssets(
            @Param("technicalStatus") String technicalStatus,
            @Param("usageStatus") String usageStatus
    );

    @Query("""
            select count(a) from Asset a
            where a.trackingMode = 'ITEMIZED'
              and (
                    coalesce(a.technicalStatus, 'Hoạt động tốt') = :technicalStatus
                    or coalesce(a.status, '') = 'Hỏng'
              )
              and coalesce(a.status, '') <> 'Bảo trì'
            """)
    long countBrokenAssets(@Param("technicalStatus") String technicalStatus);

    @Query("""
            select count(a) from Asset a
            where a.trackingMode = 'ITEMIZED'
              and coalesce(a.status, '') = 'Bảo trì'
            """)
    long countRepairingAssets(@Param("technicalStatus") String technicalStatus);
    @Query("select a from Asset a join fetch a.location l join fetch a.category c order by l.id asc, a.qaCode asc")
    List<Asset> findAllForExportOrderByLocation();
}
