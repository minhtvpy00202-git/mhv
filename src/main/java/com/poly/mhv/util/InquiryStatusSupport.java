package com.poly.mhv.util;

import java.util.Set;

public final class InquiryStatusSupport {

    public static final String ASSET_BORROW = "ASSET_BORROW";
    public static final String CONSUMABLE_REQUEST = "CONSUMABLE_REQUEST";
    public static final String NEW = "NEW";
    public static final String CLAIMED = "CLAIMED";
    public static final String IN_PROGRESS = "IN_PROGRESS";
    public static final String WAITING_EMPLOYEE = "WAITING_EMPLOYEE";
    public static final String WAITING_APPROVAL = "WAITING_APPROVAL";
    public static final String CONVERTED = "CONVERTED";
    public static final String COMPLETED = "COMPLETED";
    public static final String REJECTED = "REJECTED";
    public static final String CANCELLED = "CANCELLED";
    public static final int ASSET_BORROW_RESPONSE_SLA_MINUTES = 30;
    public static final int CONSUMABLE_RESPONSE_SLA_MINUTES = 45;

    public static final Set<String> TERMINAL_STATUSES = Set.of(COMPLETED, REJECTED, CANCELLED);
    public static final Set<String> INBOX_STATUSES = Set.of(
            NEW, CLAIMED, IN_PROGRESS, WAITING_EMPLOYEE, WAITING_APPROVAL, CONVERTED,
            COMPLETED, REJECTED, CANCELLED);

    private InquiryStatusSupport() {
    }

    public static boolean isTerminal(String status) {
        return TERMINAL_STATUSES.contains(status);
    }
}
