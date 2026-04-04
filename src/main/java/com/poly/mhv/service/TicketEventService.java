package com.poly.mhv.service;

import com.poly.mhv.dto.ticket.TicketTimelineEventResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.entity.TicketEvent;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.TicketEventRepository;
import com.poly.mhv.repository.TicketRepository;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class TicketEventService {

    private final TicketEventRepository ticketEventRepository;
    private final TicketRepository ticketRepository;
    private final CurrentUserProvider currentUserProvider;

    @Transactional
    public void recordEvent(Ticket ticket, String eventType, AppUser actor, String message, Map<String, Object> detail) {
        if (ticket == null || ticket.getId() == null) {
            return;
        }
        String actorName = actor == null
                ? "Hệ thống"
                : (StringUtils.hasText(actor.getFullName()) ? actor.getFullName() : actor.getUsername());
        TicketEvent event = TicketEvent.builder()
                .ticket(ticket)
                .eventType(eventType)
                .actorId(actor != null ? actor.getId() : null)
                .actorName(actorName)
                .message(StringUtils.hasText(message) ? message : eventType)
                .detailJson(formatDetail(detail))
                .occurredAt(LocalDateTime.now())
                .build();
        ticketEventRepository.save(event);
    }

    @Transactional(readOnly = true)
    public List<TicketTimelineEventResponse> getTimeline(Integer ticketId, Integer limit) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
        ensureCanViewTicket(ticket, currentUserProvider.getCurrentUser());
        int bounded = Math.max(1, Math.min(limit == null ? 100 : limit, 300));
        return ticketEventRepository.findByTicketIdOrderByOccurredAtDescIdDesc(ticketId, PageRequest.of(0, bounded)).stream()
                .map(this::mapToResponse)
                .sorted(Comparator.comparing(TicketTimelineEventResponse::getOccurredAt))
                .toList();
    }

    private TicketTimelineEventResponse mapToResponse(TicketEvent event) {
        return TicketTimelineEventResponse.builder()
                .id(event.getId())
                .eventType(event.getEventType())
                .actorId(event.getActorId())
                .actorName(event.getActorName())
                .message(event.getMessage())
                .detail(event.getDetailJson())
                .occurredAt(event.getOccurredAt())
                .build();
    }

    private String formatDetail(Map<String, Object> detail) {
        if (detail == null || detail.isEmpty()) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (Map.Entry<String, Object> entry : detail.entrySet()) {
            String value = entry.getValue() == null ? "" : String.valueOf(entry.getValue());
            if (!value.isBlank()) {
                if (!builder.isEmpty()) {
                    builder.append('\n');
                }
                builder.append(entry.getKey()).append(": ").append(value);
            }
        }
        return builder.toString();
    }

    private void ensureCanViewTicket(Ticket ticket, AppUser actor) {
        if ("Admin".equals(actor.getRole())) {
            return;
        }
        boolean isReporter = ticket.getReporter() != null && actor.getId().equals(ticket.getReporter().getId());
        boolean isAssignee = ticket.getAssignee() != null && actor.getId().equals(ticket.getAssignee().getId());
        if (isReporter || isAssignee) {
            return;
        }
        if ("TechSupport".equals(actor.getRole())) {
            Integer actorTechTypeId = actor.getTechSupportType() != null ? actor.getTechSupportType().getId() : 0;
            Asset asset = ticket.getAsset();
            Integer ticketTechTypeId = (asset != null && asset.getCategory() != null && asset.getCategory().getTechSupportType() != null)
                    ? asset.getCategory().getTechSupportType().getId()
                    : 0;
            if (ticketTechTypeId > 0 && actorTechTypeId.equals(ticketTechTypeId)) {
                return;
            }
        }
        throw new CustomException("Bạn không có quyền xem lịch sử ticket này.");
    }
}
