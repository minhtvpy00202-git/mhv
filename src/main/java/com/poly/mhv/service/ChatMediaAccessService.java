package com.poly.mhv.service;

import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.ChatMessage;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChatMediaAccessService {

    private final ChatMessageRepository chatMessageRepository;
    private final CurrentUserProvider currentUserProvider;

    @Transactional(readOnly = true)
    public void ensureCanRead(String mediaUrl) {
        ChatMessage message = chatMessageRepository.findFirstByMediaUrl(mediaUrl)
                .orElseThrow(() -> new CustomException("Không tìm thấy media chat."));
        Ticket ticket = message.getTicket();
        AppUser actor = currentUserProvider.getCurrentUser();
        if (actor != null && "Admin".equals(actor.getRole())) {
            return;
        }
        boolean isReporter = actor != null && ticket != null && ticket.getReporter() != null
                && actor.getId().equals(ticket.getReporter().getId());
        boolean isAssignee = actor != null && ticket != null && ticket.getAssignee() != null
                && actor.getId().equals(ticket.getAssignee().getId());
        if (!isReporter && !isAssignee) {
            throw new AccessDeniedException("Bạn không có quyền xem media chat của ticket này.");
        }
    }
}
