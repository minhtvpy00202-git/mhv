package com.poly.mhv.util;

import java.util.List;
import java.util.Set;

public final class TicketStatusSupport {

    public static final String PENDING = "PENDING";
    public static final String IN_PROGRESS = "IN_PROGRESS";
    public static final String AWAITING_CONFIRMATION = "AWAITING_CONFIRMATION";
    public static final String WAITING_REPLACEMENT = "WAITING_REPLACEMENT";
    public static final String RESOLVED = "RESOLVED";
    public static final String CLOSED_UNRESOLVED = "CLOSED_UNRESOLVED";
    public static final String CANCELLED = "CANCELLED";
    public static final String REJECTED = "REJECTED";

    public static final List<String> ACTIVE_STATUSES = List.of(
            PENDING,
            IN_PROGRESS,
            AWAITING_CONFIRMATION,
            WAITING_REPLACEMENT);

    public static final Set<String> TECHNICIAN_WORK_STATUSES = Set.of(
            IN_PROGRESS,
            WAITING_REPLACEMENT);

    public static final Set<String> CHAT_OPEN_STATUSES = Set.of(
            PENDING,
            IN_PROGRESS,
            AWAITING_CONFIRMATION,
            WAITING_REPLACEMENT);

    public static final Set<String> TERMINAL_STATUSES = Set.of(
            RESOLVED,
            CLOSED_UNRESOLVED,
            CANCELLED,
            REJECTED);

    public static final List<String> FILTERABLE_STATUSES = List.of(
            PENDING,
            IN_PROGRESS,
            AWAITING_CONFIRMATION,
            WAITING_REPLACEMENT,
            RESOLVED,
            CLOSED_UNRESOLVED,
            CANCELLED,
            REJECTED);

    private TicketStatusSupport() {
    }

    public static boolean isActive(String status) {
        return ACTIVE_STATUSES.contains(status);
    }

    public static boolean isTechnicianWork(String status) {
        return TECHNICIAN_WORK_STATUSES.contains(status);
    }

    public static boolean isChatOpen(String status) {
        return CHAT_OPEN_STATUSES.contains(status);
    }

    public static boolean isTerminal(String status) {
        return TERMINAL_STATUSES.contains(status);
    }
}
