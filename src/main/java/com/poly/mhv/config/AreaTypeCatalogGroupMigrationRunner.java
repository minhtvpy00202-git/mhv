package com.poly.mhv.config;

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
@Order(Ordered.HIGHEST_PRECEDENCE + 6)
@RequiredArgsConstructor
public class AreaTypeCatalogGroupMigrationRunner implements ApplicationRunner {

    private static final String FALLBACK_GROUP_KEY = "OTHER";
    private static final String FALLBACK_GROUP_LABEL = "Nhóm khác";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        ensureAreaGroupKeyColumn();
        ensureAreaGroupLabelColumn();
        backfillMissingAreaGroups();
    }

    private void ensureAreaGroupKeyColumn() {
        if (columnExists("asset_map_area_types", "area_group_key")) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE public.asset_map_area_types ADD COLUMN area_group_key varchar(80)");
        log.warn("Added asset_map_area_types.area_group_key column for area type grouping");
    }

    private void ensureAreaGroupLabelColumn() {
        if (columnExists("asset_map_area_types", "area_group_label")) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE public.asset_map_area_types ADD COLUMN area_group_label varchar(120)");
        log.warn("Added asset_map_area_types.area_group_label column for area type grouping");
    }

    private void backfillMissingAreaGroups() {
        if (!columnExists("asset_map_area_types", "area_group_key") || !columnExists("asset_map_area_types", "area_group_label")) {
            return;
        }
        int updatedRows = jdbcTemplate.update("""
                UPDATE public.asset_map_area_types
                SET area_group_key = ?,
                    area_group_label = ?
                WHERE area_group_key IS NULL
                   OR btrim(area_group_key) = ''
                   OR area_group_label IS NULL
                   OR btrim(area_group_label) = ''
                """, FALLBACK_GROUP_KEY, FALLBACK_GROUP_LABEL);
        if (updatedRows > 0) {
            log.warn("Backfilled fallback area groups for {} asset_map_area_types rows", updatedRows);
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
