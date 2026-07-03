package com.poly.mhv.util;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

public final class UtcDateTimes {

    private static final Clock UTC_CLOCK = Clock.systemUTC();

    private UtcDateTimes() {
    }

    public static LocalDateTime now() {
        return LocalDateTime.now(UTC_CLOCK);
    }

    public static LocalDateTime nowPlusHours(long hours) {
        return now().plusHours(hours);
    }

    public static Clock clock() {
        return UTC_CLOCK;
    }

    public static ZoneOffset offset() {
        return ZoneOffset.UTC;
    }
}
