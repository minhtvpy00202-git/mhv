package com.poly.mhv.repository;

import com.poly.mhv.entity.ConsumableInquiryFulfillment;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConsumableInquiryFulfillmentRepository extends JpaRepository<ConsumableInquiryFulfillment, Long> {

    @EntityGraph(attributePaths = {"inquiry", "inquiry.requester", "inquiry.assignee", "inquiry.asset", "sourceWarehouseLocation", "adminApprovedBy", "preparedBy"})
    Optional<ConsumableInquiryFulfillment> findByInquiryId(Long inquiryId);

    @EntityGraph(attributePaths = {"inquiry", "inquiry.requester", "inquiry.assignee", "inquiry.asset", "sourceWarehouseLocation", "adminApprovedBy", "preparedBy"})
    @Query("select f from ConsumableInquiryFulfillment f where f.id = :id")
    Optional<ConsumableInquiryFulfillment> findDetailById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"inquiry", "inquiry.requester", "inquiry.assignee", "inquiry.asset", "inquiry.destinationLocation", "sourceWarehouseLocation", "adminApprovedBy", "preparedBy"})
    @Query("select f from ConsumableInquiryFulfillment f where f.id = :id")
    Optional<ConsumableInquiryFulfillment> findForUpdateById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"inquiry", "inquiry.requester", "inquiry.assignee", "inquiry.asset", "inquiry.destinationLocation", "sourceWarehouseLocation"})
    @Query("select f from ConsumableInquiryFulfillment f where f.activeConsumableRequestId = :requestId")
    Optional<ConsumableInquiryFulfillment> findForUpdateByActiveConsumableRequestId(@Param("requestId") Long requestId);
}
