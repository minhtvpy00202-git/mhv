package com.poly.mhv.service;

import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.InquiryMessage;
import com.poly.mhv.entity.ServiceInquiry;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.InquiryMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InquiryMediaAccessService {

    private final InquiryMessageRepository inquiryMessageRepository;
    private final CurrentUserProvider currentUserProvider;

    @Transactional(readOnly = true)
    public void ensureCanRead(String mediaUrl) {
        InquiryMessage message = inquiryMessageRepository.findFirstByMediaUrl(mediaUrl)
                .orElseThrow(() -> new CustomException("Không tìm thấy media của yêu cầu."));
        ServiceInquiry inquiry = message.getInquiry();
        AppUser actor = currentUserProvider.getCurrentUser();
        if (canRead(actor, inquiry)) {
            return;
        }
        throw new AccessDeniedException("Bạn không có quyền xem media của yêu cầu này.");
    }

    private boolean canRead(AppUser actor, ServiceInquiry inquiry) {
        if (actor == null || inquiry == null) {
            return false;
        }
        if (inquiry.getRequester() != null && actor.getId().equals(inquiry.getRequester().getId())) {
            return true;
        }
        if ("Admin".equals(actor.getRole())) {
            return true;
        }
        return actor.getRole() != null && actor.getRole().equals(inquiry.getTargetRole());
    }
}
