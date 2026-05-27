package com.poly.mhv.repository;

import com.poly.mhv.entity.Supplier;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SupplierRepository extends JpaRepository<Supplier, Integer> {
    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);

    @Query("""
            select s from Supplier s
            where (coalesce(:keyword, '') = '' or lower(s.name) like lower(concat('%', :keyword, '%')))
            order by s.name asc
            """)
    List<Supplier> searchForAdmin(@Param("keyword") String keyword);

    @Query("""
            select s.id, count(a)
            from Supplier s
            left join s.assets a
            where s.id in :supplierIds
            group by s.id
            """)
    List<Object[]> countAssetsBySupplierIds(@Param("supplierIds") List<Integer> supplierIds);
}
