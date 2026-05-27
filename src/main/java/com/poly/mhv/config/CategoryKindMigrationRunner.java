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
@Order(Ordered.HIGHEST_PRECEDENCE + 5)
@RequiredArgsConstructor
public class CategoryKindMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        ensureCategoryKindColumn();
        backfillCategoryKind();
        dropTechTypeNotNullConstraint();
    }

    private void ensureCategoryKindColumn() {
        if (columnExists("categories", "category_kind")) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE public.categories ADD COLUMN category_kind varchar(20)");
        log.warn("Added categories.category_kind column for category compatibility");
    }

    private void backfillCategoryKind() {
        if (!columnExists("categories", "category_kind")) {
            return;
        }
        int updatedRows = jdbcTemplate.update("""
                UPDATE public.categories
                SET category_kind = 'ITEMIZED'
                WHERE category_kind IS NULL
                   OR btrim(category_kind) = ''
                """);
        if (updatedRows > 0) {
            log.warn("Backfilled category_kind=ITEMIZED for {} category rows", updatedRows);
        }
    }

    private void dropTechTypeNotNullConstraint() {
        if (!columnExists("categories", "tech_type_id")) {
            return;
        }
        Boolean nullable = jdbcTemplate.query("""
                SELECT c.is_nullable
                FROM information_schema.columns c
                WHERE c.table_schema = 'public'
                  AND c.table_name = 'categories'
                  AND c.column_name = 'tech_type_id'
                """, rs -> rs.next() ? "YES".equalsIgnoreCase(rs.getString(1)) : null);
        if (Boolean.TRUE.equals(nullable)) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE public.categories ALTER COLUMN tech_type_id DROP NOT NULL");
        log.warn("Dropped NOT NULL constraint on categories.tech_type_id");
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
