package com.poly.mhv.repository;

import com.poly.mhv.entity.InquiryReplyTemplate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InquiryReplyTemplateRepository extends JpaRepository<InquiryReplyTemplate, Long> {

    @EntityGraph(attributePaths = {"createdBy"})
    List<InquiryReplyTemplate> findByOwnerRoleAndActiveTrueOrderByTitleAsc(String ownerRole);

    @EntityGraph(attributePaths = {"createdBy"})
    Optional<InquiryReplyTemplate> findByIdAndOwnerRole(Long id, String ownerRole);
}
