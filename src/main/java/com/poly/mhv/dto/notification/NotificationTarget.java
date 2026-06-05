package com.poly.mhv.dto.notification;

public record NotificationTarget(
        Integer receiverUserId,
        String receiverRole,
        String linkPath
) {
    public static NotificationTarget forUser(Integer receiverUserId, String linkPath) {
        return new NotificationTarget(receiverUserId, null, linkPath);
    }

    public static NotificationTarget forRole(String receiverRole, String linkPath) {
        return new NotificationTarget(null, receiverRole, linkPath);
    }
}
