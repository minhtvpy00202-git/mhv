package com.poly.mhv.util;

import org.springframework.util.StringUtils;

public final class AssetStatusSupport {

    public static final String TECHNICAL_STATUS_GOOD = "Hoạt động tốt";
    public static final String TECHNICAL_STATUS_BROKEN = "Hỏng";
    public static final String TECHNICAL_STATUS_LOST = "Thất lạc";

    public static final String USAGE_STATUS_HOME = "Tại vị trí gốc";
    public static final String USAGE_STATUS_BORROWED = "Đang cho mượn";

    public static final String LEGACY_STATUS_AVAILABLE = "Sẵn sàng";
    public static final String LEGACY_STATUS_IN_USE = "Đang sử dụng";
    public static final String LEGACY_STATUS_BROKEN = "Hỏng";
    public static final String LEGACY_STATUS_MAINTENANCE = "Bảo trì";
    public static final String LEGACY_STATUS_LOST = "Thất lạc";

    public static final String DISPLAY_STATUS_GOOD = "Hoạt động tốt";
    public static final String DISPLAY_STATUS_BORROWED = "Đang cho mượn";
    public static final String DISPLAY_STATUS_BROKEN = "Hỏng";
    public static final String DISPLAY_STATUS_REPAIRING = "Đang sửa chữa";
    public static final String DISPLAY_STATUS_LOST = "Thất lạc";

    private AssetStatusSupport() {
    }

    public static String normalizeTechnicalStatus(String rawStatus) {
        if (!StringUtils.hasText(rawStatus)) {
            return TECHNICAL_STATUS_GOOD;
        }
        String normalized = rawStatus.trim();
        if (TECHNICAL_STATUS_GOOD.equals(normalized)
                || LEGACY_STATUS_AVAILABLE.equals(normalized)
                || LEGACY_STATUS_IN_USE.equals(normalized)) {
            return TECHNICAL_STATUS_GOOD;
        }
        if (TECHNICAL_STATUS_BROKEN.equals(normalized)
                || LEGACY_STATUS_BROKEN.equals(normalized)
                || LEGACY_STATUS_MAINTENANCE.equals(normalized)
                || DISPLAY_STATUS_REPAIRING.equals(normalized)) {
            return TECHNICAL_STATUS_BROKEN;
        }
        if (TECHNICAL_STATUS_LOST.equals(normalized) || LEGACY_STATUS_LOST.equals(normalized)) {
            return TECHNICAL_STATUS_LOST;
        }
        throw new IllegalArgumentException("Trạng thái kỹ thuật không hợp lệ: " + rawStatus);
    }

    public static String resolveTechnicalStatus(String technicalStatus, String legacyStatus) {
        try {
            String normalizedLegacy = StringUtils.hasText(legacyStatus) ? normalizeTechnicalStatus(legacyStatus) : null;
            if (StringUtils.hasText(technicalStatus)) {
                String normalizedTechnical = normalizeTechnicalStatus(technicalStatus);
                if (TECHNICAL_STATUS_GOOD.equals(normalizedTechnical) && normalizedLegacy != null
                        && !TECHNICAL_STATUS_GOOD.equals(normalizedLegacy)) {
                    return normalizedLegacy;
                }
                return normalizedTechnical;
            }
            if (normalizedLegacy != null) {
                return normalizedLegacy;
            }
        } catch (IllegalArgumentException ignored) {
            // Fall through to safe default below.
        }
        return TECHNICAL_STATUS_GOOD;
    }

    public static String normalizeUsageStatus(String rawStatus) {
        if (!StringUtils.hasText(rawStatus)) {
            return USAGE_STATUS_HOME;
        }
        String normalized = rawStatus.trim();
        if (USAGE_STATUS_HOME.equals(normalized)
                || LEGACY_STATUS_AVAILABLE.equals(normalized)
                || DISPLAY_STATUS_GOOD.equals(normalized)) {
            return USAGE_STATUS_HOME;
        }
        if (USAGE_STATUS_BORROWED.equals(normalized)
                || LEGACY_STATUS_IN_USE.equals(normalized)) {
            return USAGE_STATUS_BORROWED;
        }
        throw new IllegalArgumentException("Trạng thái sử dụng không hợp lệ: " + rawStatus);
    }

    public static boolean isAwayFromHome(Integer locationId, Integer homeLocationId) {
        return locationId != null && homeLocationId != null && !locationId.equals(homeLocationId);
    }

    public static String resolveUsageStatus(String usageStatus, String legacyStatus, Integer locationId, Integer homeLocationId) {
        try {
            if (StringUtils.hasText(usageStatus)) {
                String normalizedUsage = normalizeUsageStatus(usageStatus);
                if (USAGE_STATUS_HOME.equals(normalizedUsage) && isAwayFromHome(locationId, homeLocationId)) {
                    return USAGE_STATUS_BORROWED;
                }
                return normalizedUsage;
            }
            if (StringUtils.hasText(legacyStatus)) {
                String normalizedLegacyUsage = normalizeUsageStatus(legacyStatus);
                if (USAGE_STATUS_HOME.equals(normalizedLegacyUsage) && isAwayFromHome(locationId, homeLocationId)) {
                    return USAGE_STATUS_BORROWED;
                }
                return normalizedLegacyUsage;
            }
        } catch (IllegalArgumentException ignored) {
            // Fall through to location-based compatibility below.
        }
        return isAwayFromHome(locationId, homeLocationId) ? USAGE_STATUS_BORROWED : USAGE_STATUS_HOME;
    }

    public static boolean isRepairInProgress(String legacyStatus) {
        return LEGACY_STATUS_MAINTENANCE.equals(legacyStatus) || DISPLAY_STATUS_REPAIRING.equals(legacyStatus);
    }

    public static String deriveLegacyStatus(String technicalStatus, String usageStatus, boolean repairInProgress) {
        String normalizedTechnical = normalizeTechnicalStatus(technicalStatus);
        if (TECHNICAL_STATUS_LOST.equals(normalizedTechnical)) {
            return LEGACY_STATUS_LOST;
        }
        if (TECHNICAL_STATUS_BROKEN.equals(normalizedTechnical)) {
            return repairInProgress ? LEGACY_STATUS_MAINTENANCE : LEGACY_STATUS_BROKEN;
        }
        String normalizedUsage = normalizeUsageStatus(usageStatus);
        return USAGE_STATUS_BORROWED.equals(normalizedUsage) ? LEGACY_STATUS_IN_USE : LEGACY_STATUS_AVAILABLE;
    }

    public static String deriveDisplayStatus(String technicalStatus, String usageStatus, boolean repairInProgress) {
        String normalizedTechnical = normalizeTechnicalStatus(technicalStatus);
        if (TECHNICAL_STATUS_LOST.equals(normalizedTechnical)) {
            return DISPLAY_STATUS_LOST;
        }
        if (TECHNICAL_STATUS_BROKEN.equals(normalizedTechnical)) {
            return repairInProgress ? DISPLAY_STATUS_REPAIRING : DISPLAY_STATUS_BROKEN;
        }
        String normalizedUsage = normalizeUsageStatus(usageStatus);
        return USAGE_STATUS_BORROWED.equals(normalizedUsage) ? DISPLAY_STATUS_BORROWED : DISPLAY_STATUS_GOOD;
    }

    public static String normalizeDisplayStatusFilter(String rawStatus) {
        if (!StringUtils.hasText(rawStatus)) {
            return null;
        }
        String normalized = rawStatus.trim();
        if (DISPLAY_STATUS_GOOD.equals(normalized) || LEGACY_STATUS_AVAILABLE.equals(normalized)) {
            return DISPLAY_STATUS_GOOD;
        }
        if (DISPLAY_STATUS_BORROWED.equals(normalized) || LEGACY_STATUS_IN_USE.equals(normalized)) {
            return DISPLAY_STATUS_BORROWED;
        }
        if (DISPLAY_STATUS_BROKEN.equals(normalized) || LEGACY_STATUS_BROKEN.equals(normalized)) {
            return DISPLAY_STATUS_BROKEN;
        }
        if (DISPLAY_STATUS_REPAIRING.equals(normalized) || LEGACY_STATUS_MAINTENANCE.equals(normalized)) {
            return DISPLAY_STATUS_REPAIRING;
        }
        if (DISPLAY_STATUS_LOST.equals(normalized) || LEGACY_STATUS_LOST.equals(normalized)) {
            return DISPLAY_STATUS_LOST;
        }
        return normalized;
    }
}
