package com.poly.mhv.repository;

import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.UsageHistory;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Fetch;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

@Repository
public class UsageHistoryRepositoryImpl implements UsageHistoryRepositoryCustom {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Page<UsageHistory> searchForAdminDynamic(
            String assetName,
            Integer borrowedLocationId,
            Integer userId,
            LocalDateTime startDateTime,
            LocalDateTime endDateTime,
            Pageable pageable
    ) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();

        CriteriaQuery<UsageHistory> dataQuery = cb.createQuery(UsageHistory.class);
        Root<UsageHistory> dataRoot = dataQuery.from(UsageHistory.class);
        Fetch<UsageHistory, Asset> assetFetch = dataRoot.fetch("asset", JoinType.INNER);
        assetFetch.fetch("homeLocation", JoinType.LEFT);
        dataRoot.fetch("toLocation", JoinType.INNER);
        dataRoot.fetch("user", JoinType.INNER);

        Join<UsageHistory, Asset> assetJoin = dataRoot.join("asset", JoinType.INNER);
        Join<UsageHistory, Location> toLocationJoin = dataRoot.join("toLocation", JoinType.INNER);
        Join<UsageHistory, AppUser> userJoin = dataRoot.join("user", JoinType.INNER);
        Join<Asset, Location> homeLocationJoin = assetJoin.join("homeLocation", JoinType.LEFT);

        dataQuery.select(dataRoot).distinct(true);
        dataQuery.where(buildPredicates(
                cb,
                dataRoot,
                assetJoin,
                toLocationJoin,
                userJoin,
                assetName,
                borrowedLocationId,
                userId,
                startDateTime,
                endDateTime
        ));
        dataQuery.orderBy(buildOrders(cb, dataRoot, assetJoin, toLocationJoin, userJoin, homeLocationJoin, pageable.getSort()));

        TypedQuery<UsageHistory> typedDataQuery = entityManager.createQuery(dataQuery);
        typedDataQuery.setFirstResult((int) pageable.getOffset());
        typedDataQuery.setMaxResults(pageable.getPageSize());
        List<UsageHistory> items = typedDataQuery.getResultList();

        CriteriaQuery<Long> countQuery = cb.createQuery(Long.class);
        Root<UsageHistory> countRoot = countQuery.from(UsageHistory.class);
        Join<UsageHistory, Asset> countAssetJoin = countRoot.join("asset", JoinType.INNER);
        Join<UsageHistory, Location> countToLocationJoin = countRoot.join("toLocation", JoinType.INNER);
        Join<UsageHistory, AppUser> countUserJoin = countRoot.join("user", JoinType.INNER);
        countQuery.select(cb.countDistinct(countRoot));
        countQuery.where(buildPredicates(
                cb,
                countRoot,
                countAssetJoin,
                countToLocationJoin,
                countUserJoin,
                assetName,
                borrowedLocationId,
                userId,
                startDateTime,
                endDateTime
        ));
        long total = entityManager.createQuery(countQuery).getSingleResult();

        return new PageImpl<>(items, pageable, total);
    }

    private Predicate[] buildPredicates(
            CriteriaBuilder cb,
            Root<UsageHistory> root,
            Join<UsageHistory, Asset> assetJoin,
            Join<UsageHistory, Location> toLocationJoin,
            Join<UsageHistory, AppUser> userJoin,
            String assetName,
            Integer borrowedLocationId,
            Integer userId,
            LocalDateTime startDateTime,
            LocalDateTime endDateTime
    ) {
        List<Predicate> predicates = new ArrayList<>();
        if (StringUtils.hasText(assetName)) {
            predicates.add(cb.like(cb.lower(assetJoin.get("name")), "%" + assetName.trim().toLowerCase() + "%"));
        }
        if (borrowedLocationId != null) {
            predicates.add(cb.equal(toLocationJoin.get("id"), borrowedLocationId));
        }
        if (userId != null) {
            predicates.add(cb.equal(userJoin.get("id"), userId));
        }
        if (startDateTime != null) {
            predicates.add(cb.greaterThanOrEqualTo(root.get("startTime"), startDateTime));
        }
        if (endDateTime != null) {
            predicates.add(cb.lessThanOrEqualTo(root.get("startTime"), endDateTime));
        }
        return predicates.toArray(Predicate[]::new);
    }

    private List<Order> buildOrders(
            CriteriaBuilder cb,
            Root<UsageHistory> root,
            Join<UsageHistory, Asset> assetJoin,
            Join<UsageHistory, Location> toLocationJoin,
            Join<UsageHistory, AppUser> userJoin,
            Join<Asset, Location> homeLocationJoin,
            Sort sort
    ) {
        List<Order> orders = new ArrayList<>();
        if (sort == null || sort.isUnsorted()) {
            orders.add(cb.desc(root.get("startTime")));
            orders.add(cb.desc(root.get("id")));
            return orders;
        }
        for (Sort.Order order : sort) {
            Path<?> path = switch (order.getProperty()) {
                case "asset.qaCode" -> assetJoin.get("qaCode");
                case "asset.name" -> assetJoin.get("name");
                case "asset.homeLocation.roomName" -> homeLocationJoin.get("roomName");
                case "toLocation.roomName" -> toLocationJoin.get("roomName");
                case "user.username" -> userJoin.get("username");
                default -> root.get(order.getProperty());
            };
            orders.add(order.isAscending() ? cb.asc(path) : cb.desc(path));
        }
        return orders;
    }
}
