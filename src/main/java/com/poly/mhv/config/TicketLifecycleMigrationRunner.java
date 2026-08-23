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
@Order(Ordered.HIGHEST_PRECEDENCE + 13)
@RequiredArgsConstructor
public class TicketLifecycleMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        if (!columnExists("tickets", "version")) {
            return;
        }

        Integer statusLength = jdbcTemplate.queryForObject("""
                SELECT character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'tickets'
                  AND column_name = 'status'
                """, Integer.class);
        if (statusLength != null && statusLength < 40) {
            jdbcTemplate.execute("ALTER TABLE public.tickets ALTER COLUMN status TYPE varchar(40)");
            log.warn("Expanded tickets.status from varchar({}) to varchar(40)", statusLength);
        }

        int versionRows = jdbcTemplate.update("UPDATE public.tickets SET version = 0 WHERE version IS NULL");
        if (versionRows > 0) {
            log.warn("Backfilled optimistic-lock version for {} legacy ticket rows", versionRows);
        }

        if (columnExists("tickets", "resolution_outcome")) {
            int replacementRows = jdbcTemplate.update("""
                    UPDATE public.tickets
                    SET status = 'WAITING_REPLACEMENT',
                        resolved_at = NULL,
                        closed_at = NULL,
                        closed_reason = NULL
                    WHERE status = 'RESOLVED'
                      AND resolution_outcome = 'REPLACEMENT_REQUIRED'
                    """);
            if (replacementRows > 0) {
                log.warn("Moved {} legacy replacement tickets back to an active waiting state", replacementRows);
            }

            int unresolvedRows = jdbcTemplate.update("""
                    UPDATE public.tickets
                    SET status = 'CLOSED_UNRESOLVED',
                        resolved_at = NULL,
                        closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
                        closed_reason = COALESCE(closed_reason, 'Thiết bị được kết luận không thể sửa chữa.')
                    WHERE status = 'RESOLVED'
                      AND resolution_outcome = 'UNREPAIRABLE'
                    """);
            if (unresolvedRows > 0) {
                log.warn("Moved {} legacy unrepairable tickets to CLOSED_UNRESOLVED", unresolvedRows);
            }
        }

        if (columnExists("tickets", "sla_min_minutes") && columnExists("tickets", "sla_max_minutes")) {
            int metadataSlaRows = jdbcTemplate.update("""
                    UPDATE public.tickets
                    SET sla_min_minutes = substring(description from '\\[SLA_RANGE:([0-9]+):')::integer,
                        sla_max_minutes = substring(description from '\\[SLA_RANGE:[0-9]+:([0-9]+)\\]')::integer
                    WHERE description ~ '\\[SLA_RANGE:[0-9]+:[0-9]+\\]'
                      AND (
                            sla_min_minutes IS DISTINCT FROM substring(description from '\\[SLA_RANGE:([0-9]+):')::integer
                            OR sla_max_minutes IS DISTINCT FROM substring(description from '\\[SLA_RANGE:[0-9]+:([0-9]+)\\]')::integer
                      )
                    """);
            if (metadataSlaRows > 0) {
                log.warn("Recovered SLA min/max from metadata for {} legacy ticket rows", metadataSlaRows);
            }

            int slaRows = jdbcTemplate.update("""
                    UPDATE public.tickets
                    SET sla_min_minutes = greatest(1, extract(epoch from (due_date - created_at))::integer / 60),
                        sla_max_minutes = greatest(1, extract(epoch from (due_date - created_at))::integer / 60)
                    WHERE due_date IS NOT NULL
                      AND created_at IS NOT NULL
                      AND (sla_min_minutes IS NULL OR sla_max_minutes IS NULL)
                      AND description !~ '\\[SLA_RANGE:[0-9]+:[0-9]+\\]'
                    """);
            if (slaRows > 0) {
                log.warn("Backfilled SLA range for {} legacy ticket rows", slaRows);
            }

            int activeDueDateRows = jdbcTemplate.update("""
                    UPDATE public.tickets
                    SET due_date = created_at + (sla_max_minutes * interval '1 minute')
                    WHERE status IN ('PENDING', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'WAITING_REPLACEMENT')
                      AND created_at IS NOT NULL
                      AND sla_max_minutes IS NOT NULL
                      AND due_date IS DISTINCT FROM created_at + (sla_max_minutes * interval '1 minute')
                    """);
            if (activeDueDateRows > 0) {
                log.warn("Aligned hard SLA deadline for {} active legacy ticket rows", activeDueDateRows);
            }
        }

        Long duplicateActiveAssets = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM (
                    SELECT asset_qa_code
                    FROM public.tickets
                    WHERE status IN ('PENDING', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'WAITING_REPLACEMENT')
                    GROUP BY asset_qa_code
                    HAVING count(*) > 1
                ) duplicate_assets
                """, Long.class);
        if (duplicateActiveAssets != null && duplicateActiveAssets > 0) {
            log.error("Detected {} assets with duplicate active tickets. Database uniqueness index was not created; "
                    + "new duplicates are still prevented by application locks.", duplicateActiveAssets);
            return;
        }

        jdbcTemplate.execute("DROP INDEX IF EXISTS public.uq_tickets_one_active_per_asset");
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX uq_tickets_one_active_per_asset
                ON public.tickets (asset_qa_code)
                WHERE status IN ('PENDING', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'WAITING_REPLACEMENT')
                """);
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
