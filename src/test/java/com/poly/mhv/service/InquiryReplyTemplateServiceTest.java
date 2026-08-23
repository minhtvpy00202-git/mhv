package com.poly.mhv.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.poly.mhv.dto.inquiry.InquiryReplyTemplateRequest;
import com.poly.mhv.dto.inquiry.InquiryReplyTemplateResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.InquiryReplyTemplate;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.InquiryReplyTemplateRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InquiryReplyTemplateServiceTest {

    @Mock private InquiryReplyTemplateRepository repository;
    @Mock private CurrentUserProvider currentUserProvider;

    @InjectMocks private InquiryReplyTemplateService service;

    @Test
    void createdTemplateIsSharedOnlyWithinCurrentHandlerRole() {
        AppUser manager = AppUser.builder()
                .id(7).username("supply").fullName("Quản lý vật tư").role("ConsumableManager").build();
        when(currentUserProvider.getCurrentUser()).thenReturn(manager);
        when(repository.save(any(InquiryReplyTemplate.class))).thenAnswer(invocation -> {
            InquiryReplyTemplate template = invocation.getArgument(0);
            template.setId(12L);
            return template;
        });

        InquiryReplyTemplateResponse response = service.create(InquiryReplyTemplateRequest.builder()
                .title("  Xác nhận còn hàng  ")
                .content("  Vật tư hiện còn đủ số lượng.  ")
                .build());

        assertThat(response.getId()).isEqualTo(12L);
        assertThat(response.getOwnerRole()).isEqualTo("ConsumableManager");
        assertThat(response.getTitle()).isEqualTo("Xác nhận còn hàng");
        assertThat(response.getContent()).isEqualTo("Vật tư hiện còn đủ số lượng.");
    }

    @Test
    void handlerCannotEditTemplateFromAnotherRole() {
        AppUser manager = AppUser.builder().id(7).username("supply").role("ConsumableManager").build();
        when(currentUserProvider.getCurrentUser()).thenReturn(manager);
        when(repository.findByIdAndOwnerRole(99L, "ConsumableManager")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(99L, InquiryReplyTemplateRequest.builder()
                .title("Mẫu")
                .content("Nội dung")
                .build()))
                .isInstanceOf(CustomException.class)
                .hasMessageContaining("bộ phận hiện tại");
    }
}
