package com.poly.mhv.util;

import java.util.Set;

public final class ConsumableFulfillmentStatusSupport {

    public static final String PENDING = "PENDING";
    public static final String PREPARING = "PREPARING";
    public static final String READY_FOR_PICKUP = "READY_FOR_PICKUP";
    public static final String PARTIALLY_FULFILLED = "PARTIALLY_FULFILLED";
    public static final String FULFILLED = "FULFILLED";
    public static final String REJECTED = "REJECTED";
    public static final String CANCELLED = "CANCELLED";

    public static final Set<String> TERMINAL_STATUSES = Set.of(FULFILLED, REJECTED, CANCELLED);

    private ConsumableFulfillmentStatusSupport() {
    }

    public static boolean isTerminal(String status) {
        return TERMINAL_STATUSES.contains(status);
    }
}
