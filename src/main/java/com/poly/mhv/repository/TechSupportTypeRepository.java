package com.poly.mhv.repository;

import com.poly.mhv.entity.TechSupportType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TechSupportTypeRepository extends JpaRepository<TechSupportType, Integer> {
    boolean existsByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);

    @Query("""
            select t from TechSupportType t
            where t.id > 0
              and (coalesce(:keyword, '') = '' or lower(t.name) like lower(concat('%', :keyword, '%')))
            order by t.name asc
            """)
    List<TechSupportType> searchForAdmin(@Param("keyword") String keyword);

    @Query("""
            select t from TechSupportType t
            where t.id = :id and t.id > 0
            """)
    Optional<TechSupportType> findManageableById(@Param("id") Integer id);

    @Query("select coalesce(max(t.id), 0) from TechSupportType t")
    Integer findMaxId();
}
