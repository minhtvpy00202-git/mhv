package com.poly.mhv.repository;

import com.poly.mhv.entity.RoomShape;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoomShapeRepository extends JpaRepository<RoomShape, Long> {

    @EntityGraph(attributePaths = {"floor", "location", "location.floor"})
    List<RoomShape> findByFloorIdOrderByIdAsc(Integer floorId);

    long countByFloorId(Integer floorId);

    @EntityGraph(attributePaths = {"floor", "location", "location.floor"})
    Optional<RoomShape> findByLocationId(Integer locationId);

    @Query("""
            select rs from RoomShape rs
            join fetch rs.floor f
            join fetch rs.location l
            left join fetch l.floor lf
            order by case when f.sortOrder is null then 1 else 0 end, f.sortOrder asc, f.id asc, rs.id asc
            """)
    List<RoomShape> findAllWithFloorAndLocation();

    @Query("""
            select rs from RoomShape rs
            join fetch rs.floor f
            join fetch rs.location l
            left join fetch l.floor lf
            where rs.id = :id
            """)
    Optional<RoomShape> findDetailById(@Param("id") Long id);
}
