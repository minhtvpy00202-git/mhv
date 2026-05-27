package com.poly.mhv.repository;

import com.poly.mhv.entity.ConsumableIssue;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsumableIssueRepository extends JpaRepository<ConsumableIssue, Long> {

    @EntityGraph(attributePaths = {"asset", "issuedToLocation", "issuedBy"})
    List<ConsumableIssue> findByAssetQaCodeOrderByIssuedAtDescIdDesc(String assetQaCode);
}
