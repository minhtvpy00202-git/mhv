package com.poly.mhv.repository;

import com.poly.mhv.dto.notification.NotificationItemResponse;
import com.poly.mhv.entity.Notification;
import java.util.List;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Integer> {
    @Query("""
            select new com.poly.mhv.dto.notification.NotificationItemResponse(
                n.id,
                n.eventType,
                n.title,
                n.message,
                n.assetName,
                n.linkPath,
                n.occurredAt,
                n.isRead
            )
            from Notification n
            where n.receiverUserId = :userId
               or (n.receiverUserId is null and n.receiverRole = :role)
               or (:role = 'Admin' and n.receiverUserId is null and n.receiverRole is null)
            order by n.occurredAt desc, n.id desc
            """)
    List<NotificationItemResponse> findTop50FeedItemsForViewer(
            @Param("userId") Integer userId,
            @Param("role") String role,
            org.springframework.data.domain.Pageable pageable
    );

    @Query("""
            select count(n)
            from Notification n
            where n.isRead = false
              and (
                    n.receiverUserId = :userId
                    or (n.receiverUserId is null and n.receiverRole = :role)
                    or (:role = 'Admin' and n.receiverUserId is null and n.receiverRole is null)
              )
            """)
    long countUnreadForViewer(@Param("userId") Integer userId, @Param("role") String role);

    @Query("""
            select n
            from Notification n
            where n.id = :id
              and (
                    n.receiverUserId = :userId
                    or (n.receiverUserId is null and n.receiverRole = :role)
                    or (:role = 'Admin' and n.receiverUserId is null and n.receiverRole is null)
              )
            """)
    java.util.Optional<Notification> findAccessibleById(
            @Param("id") Integer id,
            @Param("userId") Integer userId,
            @Param("role") String role
    );

    @Modifying
    @Query("""
            update Notification n
            set n.isRead = true
            where n.isRead = false
              and (
                    n.receiverUserId = :userId
                    or (n.receiverUserId is null and n.receiverRole = :role)
                    or (:role = 'Admin' and n.receiverUserId is null and n.receiverRole is null)
              )
            """)
    int markAllAsReadForViewer(@Param("userId") Integer userId, @Param("role") String role);
}
