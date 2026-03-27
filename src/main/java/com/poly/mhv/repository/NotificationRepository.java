package com.poly.mhv.repository;

import com.poly.mhv.entity.Notification;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Integer> {
    List<Notification> findTop50ByOrderByOccurredAtDescIdDesc();
    long countByIsReadFalse();
}
