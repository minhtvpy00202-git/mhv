package com.poly.mhv.repository;

import com.poly.mhv.entity.Notification;
import java.util.List;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Integer> {
    List<Notification> findTop50ByOrderByOccurredAtDescIdDesc();
    long countByIsReadFalse();

    @Modifying
    @Query("update Notification n set n.isRead = true where n.isRead = false")
    int markAllAsRead();
}
