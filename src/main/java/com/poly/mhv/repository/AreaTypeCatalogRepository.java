package com.poly.mhv.repository;

import com.poly.mhv.entity.AreaTypeCatalog;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AreaTypeCatalogRepository extends JpaRepository<AreaTypeCatalog, Integer> {

    List<AreaTypeCatalog> findAllByOrderBySortOrderAscLabelAsc();

    boolean existsByTypeKeyIgnoreCase(String typeKey);

    boolean existsByTypeKeyIgnoreCaseAndIdNot(String typeKey, Integer id);

    boolean existsByLabelIgnoreCase(String label);

    boolean existsByLabelIgnoreCaseAndIdNot(String label, Integer id);

    Optional<AreaTypeCatalog> findByTypeKeyIgnoreCase(String typeKey);

    Optional<AreaTypeCatalog> findByLabelIgnoreCase(String label);

    List<AreaTypeCatalog> findByIsStorageWarehouseTrueOrderBySortOrderAscLabelAsc();
}
