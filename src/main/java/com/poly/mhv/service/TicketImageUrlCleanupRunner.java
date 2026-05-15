package com.poly.mhv.service;

import com.poly.mhv.entity.Ticket;
import com.poly.mhv.repository.TicketRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Component
@ConditionalOnProperty(prefix = "app.cleanup.ticket-image-url", name = "enabled", havingValue = "true")
public class TicketImageUrlCleanupRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(TicketImageUrlCleanupRunner.class);

    private final TicketRepository ticketRepository;
    private final TicketImageStorageService ticketImageStorageService;
    private final boolean dryRun;
    private final int logLimit;

    public TicketImageUrlCleanupRunner(
            TicketRepository ticketRepository,
            TicketImageStorageService ticketImageStorageService,
            @Value("${app.cleanup.ticket-image-url.dry-run:true}") boolean dryRun,
            @Value("${app.cleanup.ticket-image-url.log-limit:20}") int logLimit
    ) {
        this.ticketRepository = ticketRepository;
        this.ticketImageStorageService = ticketImageStorageService;
        this.dryRun = dryRun;
        this.logLimit = logLimit;
    }

    @Override
    @Transactional
    public void run(String... args) {
        List<Ticket> tickets = ticketRepository.findByImageUrlIsNotNullOrderByIdAsc();
        if (tickets.isEmpty()) {
            log.info("ticket-image-url-cleanup: không có ticket nào cần kiểm tra image_url.");
            return;
        }

        List<Ticket> changedTickets = new ArrayList<>();
        int inspected = 0;
        int changed = 0;
        int logged = 0;

        for (Ticket ticket : tickets) {
            inspected++;
            String currentValue = ticket.getImageUrl();
            String nextValue = normalizeForCleanup(currentValue);
            if (Objects.equals(currentValue, nextValue)) {
                continue;
            }

            changed++;
            if (logged < logLimit) {
                log.info(
                        "ticket-image-url-cleanup: ticketId={} | old={} | new={}",
                        ticket.getId(),
                        abbreviate(currentValue),
                        abbreviate(nextValue)
                );
                logged++;
            }

            if (!dryRun) {
                ticket.setImageUrl(nextValue);
                changedTickets.add(ticket);
            }
        }

        if (dryRun) {
            log.info(
                    "ticket-image-url-cleanup: DRY RUN hoàn tất. inspected={}, changed={}, unchanged={}",
                    inspected,
                    changed,
                    inspected - changed
            );
            log.info("ticket-image-url-cleanup: bật app.cleanup.ticket-image-url.dry-run=false để ghi thay đổi vào DB.");
            return;
        }

        if (!changedTickets.isEmpty()) {
            ticketRepository.saveAll(changedTickets);
        }

        log.info(
                "ticket-image-url-cleanup: APPLY hoàn tất. inspected={}, changed={}, unchanged={}",
                inspected,
                changed,
                inspected - changed
        );
    }

    private String normalizeForCleanup(String rawImageUrl) {
        if (!StringUtils.hasText(rawImageUrl)) {
            return null;
        }
        String normalized = rawImageUrl.trim();
        if (normalized.startsWith("data:")) {
            return dryRun ? "[DATA_URL_WILL_BE_STORED_TO_UPLOADS]" : ticketImageStorageService.normalizeTicketImageUrl(normalized);
        }
        return ticketImageStorageService.toPublicImageUrl(normalized);
    }

    private String abbreviate(String value) {
        if (value == null) {
            return "null";
        }
        String normalized = value.replaceAll("\\s+", " ").trim();
        if (normalized.length() <= 120) {
            return normalized;
        }
        return normalized.substring(0, 117) + "...";
    }
}
