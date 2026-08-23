package com.poly.mhv.service;

import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.poly.mhv.util.TicketStatusSupport;

@Service
@RequiredArgsConstructor
public class TicketMediaAccessService {

    private final TicketRepository ticketRepository;
    private final CurrentUserProvider currentUserProvider;

    @Transactional(readOnly = true)
    public void ensureCanRead(String storedPath) {
        Ticket ticket = ticketRepository.findFirstByImageUrlOrResolutionImageUrl(storedPath, storedPath)
                .orElseThrow(() -> new CustomException("Không tìm thấy ảnh ticket."));
        AppUser actor = currentUserProvider.getCurrentUser();
        if ("Admin".equals(actor.getRole())) {
            return;
        }
        boolean isReporter = ticket.getReporter() != null
                && actor.getId().equals(ticket.getReporter().getId());
        boolean isAssignee = ticket.getAssignee() != null
                && actor.getId().equals(ticket.getAssignee().getId());
        if (isReporter || isAssignee) {
            return;
        }
        if ("TechSupport".equals(actor.getRole())
                && TicketStatusSupport.PENDING.equals(ticket.getStatus())
                && hasMatchingSpecialty(actor, ticket.getAsset())) {
            return;
        }
        throw new AccessDeniedException("Bạn không có quyền xem ảnh của ticket này.");
    }

    private boolean hasMatchingSpecialty(AppUser actor, Asset asset) {
        if (asset == null || asset.getCategory() == null || asset.getCategory().getTechSupportType() == null) {
            return false;
        }
        Integer requiredTypeId = asset.getCategory().getTechSupportType().getId();
        return actor.getTechSupportTypes() != null && actor.getTechSupportTypes().stream()
                .anyMatch(type -> type != null && requiredTypeId.equals(type.getId()));
    }
}
