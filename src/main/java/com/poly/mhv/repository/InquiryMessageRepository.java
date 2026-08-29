package com.poly.mhv.repository;

import com.poly.mhv.entity.InquiryMessage;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InquiryMessageRepository extends JpaRepository<InquiryMessage, Long> {

    @EntityGraph(attributePaths = {"sender"})
    List<InquiryMessage> findByInquiryIdOrderByCreatedAtAscIdAsc(Long inquiryId);

    @EntityGraph(attributePaths = {"inquiry", "inquiry.requester", "inquiry.assignee", "sender"})
    Optional<InquiryMessage> findFirstByMediaUrl(String mediaUrl);

    @Query("""
            select count(m) from InquiryMessage m
            where m.inquiry.id = :inquiryId
              and m.sender.id <> :viewerId
              and m.readAt is null
            """)
    long countUnread(@Param("inquiryId") Long inquiryId, @Param("viewerId") Integer viewerId);

    @Query("""
            select m from InquiryMessage m
            where m.inquiry.id = :inquiryId
              and m.sender.id <> :viewerId
              and m.readAt is null
            """)
    List<InquiryMessage> findUnread(@Param("inquiryId") Long inquiryId, @Param("viewerId") Integer viewerId);
}
