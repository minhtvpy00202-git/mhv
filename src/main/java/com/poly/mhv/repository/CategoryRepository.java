package com.poly.mhv.repository;

import com.poly.mhv.dto.category.CategoryOptionResponse;
import com.poly.mhv.dto.category.CategorySummaryRow;
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
            select new com.poly.mhv.dto.category.CategorySummaryRow(
                c.id,
                c.name,
                c.categoryKind,
                t.id,
                t.name,
                c.specTemplates
            )
            from Category c
            left join c.techSupportType t
            where (coalesce(:keyword, '') = '' or lower(c.name) like lower(concat('%', :keyword, '%')))
              and (:techTypeId is null or t.id = :techTypeId)
            order by c.name asc
            """)
    List<CategorySummaryRow> searchForAdmin(@Param("keyword") String keyword, @Param("techTypeId") Integer techTypeId);

    @Query("""
            select new com.poly.mhv.dto.category.CategoryOptionResponse(
                c.id,
                c.name,
                c.codePrefix,
                c.categoryKind
            )
            from Category c
            order by c.name asc
            """)
    List<CategoryOptionResponse> findAllOptions();

    @Query("""
            select c from Category c
            where c.id in :ids
            """)
    List<Category> findAllByIdIn(@Param("ids") List<Integer> ids);

    @Query("""
            select c from Category c
            left join fetch c.techSupportType
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
