package com.poly.mhv.config;

import com.poly.mhv.util.AssetStatusSupport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 11)
@RequiredArgsConstructor
public class AssetDualStatusMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        if (!columnExists("assets", "technical_status") || !columnExists("assets", "usage_status")) {
            return;
        }

        int updatedRows = jdbcTemplate.update("""
                UPDATE public.assets
                SET technical_status = CASE
                        WHEN status = 'Hỏng' THEN ?
                        WHEN status = 'Bảo trì' THEN ?
                        WHEN status = 'Thất lạc' THEN ?
                        ELSE ?
                    END,
                    usage_status = CASE
                        WHEN tracking_mode = 'CONSUMABLE' THEN NULL
                        WHEN status = 'Đang sử dụng' THEN ?
                        ELSE ?
                    END
                WHERE tracking_mode = 'ITEMIZED'
                  AND (
                        technical_status IS NULL
                        OR btrim(technical_status) = ''
                        OR usage_status IS NULL
                        OR btrim(usage_status) = ''
                  )
                """,
                AssetStatusSupport.TECHNICAL_STATUS_BROKEN,
                AssetStatusSupport.TECHNICAL_STATUS_BROKEN,
                AssetStatusSupport.TECHNICAL_STATUS_LOST,
                AssetStatusSupport.TECHNICAL_STATUS_GOOD,
                AssetStatusSupport.USAGE_STATUS_BORROWED,
                AssetStatusSupport.USAGE_STATUS_HOME
        );

        if (updatedRows > 0) {
            log.warn("Backfilled technical_status and usage_status for {} legacy asset rows", updatedRows);
        }

        int repairedTechnicalRows = jdbcTemplate.update("""
                UPDATE public.assets
                SET technical_status = CASE
                        WHEN status = 'Hỏng' THEN ?
                        WHEN status = 'Bảo trì' THEN ?
                        WHEN status = 'Thất lạc' THEN ?
                        ELSE technical_status
                    END
                WHERE tracking_mode = 'ITEMIZED'
                  AND (
                        (status IN ('Hỏng', 'Bảo trì') AND coalesce(technical_status, '') <> ?)
                        OR (status = 'Thất lạc' AND coalesce(technical_status, '') <> ?)
                  )
                """,
                AssetStatusSupport.TECHNICAL_STATUS_BROKEN,
                AssetStatusSupport.TECHNICAL_STATUS_BROKEN,
                AssetStatusSupport.TECHNICAL_STATUS_LOST,
                AssetStatusSupport.TECHNICAL_STATUS_BROKEN,
                AssetStatusSupport.TECHNICAL_STATUS_LOST
        );

        if (repairedTechnicalRows > 0) {
            log.warn("Repaired {} asset rows with stale technical_status values", repairedTechnicalRows);
        }

        int repairedBorrowedRows = jdbcTemplate.update("""
                UPDATE public.assets
                SET usage_status = ?,
                    status = CASE
                        WHEN coalesce(technical_status, ?) = ? THEN ?
                        ELSE status
                    END
                WHERE tracking_mode = 'ITEMIZED'
                  AND home_location_id IS NOT NULL
                  AND location_id IS NOT NULL
                  AND location_id <> home_location_id
                  AND (
                        usage_status IS NULL
                        OR btrim(usage_status) = ''
                        OR usage_status <> ?
                  )
                """,
                AssetStatusSupport.USAGE_STATUS_BORROWED,
                AssetStatusSupport.TECHNICAL_STATUS_GOOD,
                AssetStatusSupport.TECHNICAL_STATUS_GOOD,
                AssetStatusSupport.LEGACY_STATUS_IN_USE,
                AssetStatusSupport.USAGE_STATUS_BORROWED
        );

        if (repairedBorrowedRows > 0) {
            log.warn("Repaired {} borrowed asset rows with stale usage_status values", repairedBorrowedRows);
        }
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = ?
                  AND column_name = ?
                """, Integer.class, tableName, columnName);
        return count != null && count > 0;
    }
}
