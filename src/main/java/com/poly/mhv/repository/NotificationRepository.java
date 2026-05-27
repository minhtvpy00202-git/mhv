package com.poly.mhv.repository;

import com.poly.mhv.dto.notification.NotificationItemResponse;
import com.poly.mhv.entity.Notification;
import java.util.List;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;

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
            order by n.occurredAt desc, n.id desc
            """)
    List<NotificationItemResponse> findTop50FeedItems(org.springframework.data.domain.Pageable pageable);

    long countByIsReadFalse();

    @Modifying
    @Query("update Notification n set n.isRead = true where n.isRead = false")
    int markAllAsRead();
}
