package com.poly.mhv.service;

import com.poly.mhv.dto.inquiry.InquiryReplyTemplateRequest;
import com.poly.mhv.dto.inquiry.InquiryReplyTemplateResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.InquiryReplyTemplate;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.InquiryReplyTemplateRepository;
import com.poly.mhv.util.UtcDateTimes;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class InquiryReplyTemplateService {

    private final InquiryReplyTemplateRepository repository;
    private final CurrentUserProvider currentUserProvider;

    @Transactional(readOnly = true)
    public List<InquiryReplyTemplateResponse> getAll() {
        AppUser actor = requireHandler();
        return repository.findByOwnerRoleAndActiveTrueOrderByTitleAsc(actor.getRole()).stream()
                .map(this::mapResponse)
                .toList();
    }

    @Transactional
    public InquiryReplyTemplateResponse create(InquiryReplyTemplateRequest request) {
        AppUser actor = requireHandler();
        LocalDateTime now = UtcDateTimes.now();
        InquiryReplyTemplate saved = repository.save(InquiryReplyTemplate.builder()
                .ownerRole(actor.getRole())
                .createdBy(actor)
                .title(request.getTitle().trim())
                .content(request.getContent().trim())
                .active(true)
                .createdAt(now)
                .updatedAt(now)
                .build());
        return mapResponse(saved);
    }

    @Transactional
    public InquiryReplyTemplateResponse update(Long id, InquiryReplyTemplateRequest request) {
        AppUser actor = requireHandler();
        InquiryReplyTemplate template = getForRole(id, actor.getRole());
        template.setTitle(request.getTitle().trim());
        template.setContent(request.getContent().trim());
        template.setUpdatedAt(UtcDateTimes.now());
        return mapResponse(repository.save(template));
    }

    @Transactional
    public void delete(Long id) {
        AppUser actor = requireHandler();
        InquiryReplyTemplate template = getForRole(id, actor.getRole());
        template.setActive(false);
        template.setUpdatedAt(UtcDateTimes.now());
        repository.save(template);
    }

    private AppUser requireHandler() {
        AppUser actor = currentUserProvider.getCurrentUser();
        if (actor == null || !List.of("Admin", "ConsumableManager").contains(actor.getRole())) {
            throw new AccessDeniedException("Bạn không có quyền sử dụng câu trả lời mẫu.");
        }
        return actor;
    }

    private InquiryReplyTemplate getForRole(Long id, String role) {
        if (id == null) {
            throw new CustomException("ID mẫu trả lời là bắt buộc.");
        }
        return repository.findByIdAndOwnerRole(id, role)
                .orElseThrow(() -> new CustomException("Không tìm thấy mẫu trả lời của bộ phận hiện tại."));
    }

    private InquiryReplyTemplateResponse mapResponse(InquiryReplyTemplate template) {
        AppUser creator = template.getCreatedBy();
        String creatorName = creator != null && StringUtils.hasText(creator.getFullName())
                ? creator.getFullName().trim()
                : (creator != null ? creator.getUsername() : "Hệ thống");
        return InquiryReplyTemplateResponse.builder()
                .id(template.getId())
                .ownerRole(template.getOwnerRole())
                .createdByUserId(creator != null ? creator.getId() : null)
                .createdByName(creatorName)
                .title(template.getTitle())
                .content(template.getContent())
                .createdAt(toOffset(template.getCreatedAt()))
                .updatedAt(toOffset(template.getUpdatedAt()))
                .build();
    }

    private OffsetDateTime toOffset(LocalDateTime value) {
        return value == null ? null : value.atOffset(ZoneOffset.UTC);
    }
}
