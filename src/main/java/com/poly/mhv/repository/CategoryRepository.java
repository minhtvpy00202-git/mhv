package com.poly.mhv.repository;

import com.poly.mhv.entity.Category;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CategoryRepository extends JpaRepository<Category, Integer> {
    List<Category> findAllByOrderByNameAsc();
    boolean existsByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);
    boolean existsByCodePrefixIgnoreCase(String codePrefix);
    long countByTechSupportTypeId(Integer techTypeId);

    @Query("""
            select c from Category c
            join fetch c.techSupportType t
            where (coalesce(:keyword, '') = '' or lower(c.name) like lower(concat('%', :keyword, '%')))
              and (:techTypeId is null or t.id = :techTypeId)
            order by c.name asc
            """)
    List<Category> searchForAdmin(@Param("keyword") String keyword, @Param("techTypeId") Integer techTypeId);

    @Query("""
            select c from Category c
            join fetch c.techSupportType
            where c.id = :id
            """)
    Optional<Category> findDetailById(@Param("id") Integer id);

    @Query("""
            select c.techSupportType.id, count(c)
            from Category c
            where c.techSupportType.id in :techTypeIds
            group by c.techSupportType.id
            """)
    List<Object[]> countByTechSupportTypeIds(@Param("techTypeIds") List<Integer> techTypeIds);
}
