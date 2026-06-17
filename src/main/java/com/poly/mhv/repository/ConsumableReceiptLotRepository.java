package com.poly.mhv.repository;

import com.poly.mhv.entity.ConsumableReceiptLot;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConsumableReceiptLotRepository extends JpaRepository<ConsumableReceiptLot, Long> {

    @EntityGraph(attributePaths = {"asset", "supplier", "receivedBy"})
    List<ConsumableReceiptLot> findByAssetQaCodeOrderByReceivedDateDescIdDesc(String assetQaCode);

    @EntityGraph(attributePaths = {"asset", "supplier", "receivedBy"})
    List<ConsumableReceiptLot> findByAssetQaCodeAndQuantityRemainingGreaterThan(String assetQaCode, Integer quantityRemaining);

    @EntityGraph(attributePaths = {"asset", "supplier", "receivedBy"})
    List<ConsumableReceiptLot> findByAssetQaCodeOrderByReceivedDateAscIdAsc(String assetQaCode);

    @EntityGraph(attributePaths = {"asset", "supplier", "receivedBy"})
    List<ConsumableReceiptLot> findByQuantityRemainingGreaterThanAndExpirationDateBeforeOrderByExpirationDateAscReceivedDateAscIdAsc(
            Integer quantityRemaining,
            LocalDate expirationDate
    );

    @Override
    @EntityGraph(attributePaths = {"asset", "supplier", "receivedBy"})
    Optional<ConsumableReceiptLot> findById(Long id);

    boolean existsByAssetQaCodeAndQuantityRemainingGreaterThanAndExpirationDateIsNotNull(String assetQaCode, Integer quantityRemaining);

    boolean existsByAssetQaCodeAndQuantityRemainingGreaterThanAndExpirationDateIsNull(String assetQaCode, Integer quantityRemaining);

    void deleteByAssetQaCode(String assetQaCode);

    @Query("""
            select count(lot)
            from ConsumableReceiptLot lot
            join lot.asset a
            where lot.quantityRemaining > 0
              and lot.expirationDate is not null
              and lot.expirationDate < :today
              and (:categoryId is null or a.category.id = :categoryId)
              and (:locationId is null or a.location.id = :locationId)
            """)
    long countExpiredOpenLotsForStatistics(
            @Param("today") LocalDate today,
            @Param("categoryId") Integer categoryId,
            @Param("locationId") Integer locationId
    );

    @Query("""
            select count(lot)
            from ConsumableReceiptLot lot
            join lot.asset a
            where lot.quantityRemaining > 0
              and lot.expirationDate is not null
              and lot.expirationDate >= :today
              and lot.expirationDate <= :untilDate
              and (:categoryId is null or a.category.id = :categoryId)
              and (:locationId is null or a.location.id = :locationId)
            """)
    long countExpiringOpenLotsForStatistics(
            @Param("today") LocalDate today,
            @Param("untilDate") LocalDate untilDate,
            @Param("categoryId") Integer categoryId,
            @Param("locationId") Integer locationId
    );

    @Query(value = """
            select coalesce(sum(l.quantity_remaining * l.unit_price), 0)
            from consumable_receipt_lots l
            join assets a on a.qa_code = l.asset_qa_code
            where l.quantity_remaining > 0
              and (:categoryId is null or a.category_id = :categoryId)
              and (:locationId is null or a.location_id = :locationId)
            """, nativeQuery = true)
    BigDecimal sumOpenLotInventoryValueForStatistics(
            @Param("categoryId") Integer categoryId,
            @Param("locationId") Integer locationId
    );

    @Query("""
            select count(lot)
            from ConsumableReceiptLot lot
            join lot.asset a
            where lot.quantityRemaining > 0
              and lot.expirationDate is not null
              and lot.expirationDate < :today
              and (coalesce(:name, '') = ''
                   or lower(a.name) like lower(concat('%', :name, '%'))
                   or lower(a.qaCode) like lower(concat('%', :name, '%')))
              and (:categoryId is null or a.category.id = :categoryId)
              and (:locationId is null or a.location.id = :locationId)
            """)
    long countExpiredOpenLotsForInventorySummary(
            @Param("today") LocalDate today,
            @Param("name") String name,
            @Param("categoryId") Integer categoryId,
            @Param("locationId") Integer locationId
    );

    @Query(value = """
            select coalesce(sum(l.quantity_remaining * l.unit_price), 0)
            from consumable_receipt_lots l
            join assets a on a.qa_code = l.asset_qa_code
            where l.quantity_remaining > 0
              and (coalesce(:name, '') = ''
                   or lower(a.name) like lower(concat('%', :name, '%'))
                   or lower(a.qa_code) like lower(concat('%', :name, '%')))
              and (:categoryId is null or a.category_id = :categoryId)
              and (:locationId is null or a.location_id = :locationId)
            """, nativeQuery = true)
    BigDecimal sumOpenLotInventoryValueForInventorySummary(
            @Param("name") String name,
            @Param("categoryId") Integer categoryId,
            @Param("locationId") Integer locationId
    );

    @Query(value = """
            select row_value, count(*) as row_count
            from (
                select case
                    when l.expiration_date is null then 'Không quản lý hạn'
                    when l.expiration_date < :today then 'Đã hết hạn'
                    when l.expiration_date <= :todayPlus7 then 'Sắp hết hạn 7 ngày'
                    when l.expiration_date <= :todayPlus30 then 'Sắp hết hạn 30 ngày'
                    else 'Còn hạn'
                end as row_value,
                case
                    when l.expiration_date is null then 5
                    when l.expiration_date < :today then 1
                    when l.expiration_date <= :todayPlus7 then 2
                    when l.expiration_date <= :todayPlus30 then 3
                    else 4
                end as sort_order
                from consumable_receipt_lots l
                join assets a on a.qa_code = l.asset_qa_code
                where l.quantity_remaining > 0
                  and (:categoryId is null or a.category_id = :categoryId)
                  and (:locationId is null or a.location_id = :locationId)
            ) rows
            group by row_value
            order by min(sort_order) asc
            """, nativeQuery = true)
    List<Object[]> countOpenLotsByExpiryBucketForStatistics(
            @Param("today") LocalDate today,
            @Param("todayPlus7") LocalDate todayPlus7,
            @Param("todayPlus30") LocalDate todayPlus30,
            @Param("categoryId") Integer categoryId,
            @Param("locationId") Integer locationId
    );
}
