package com.poly.mhv.controller;

import com.poly.mhv.dto.ticket.TicketAssignRequest;
import com.poly.mhv.dto.ticket.TicketCreateRequest;
import com.poly.mhv.dto.ticket.TicketResponse;
import com.poly.mhv.dto.ticket.TicketTimelineEventResponse;
import com.poly.mhv.service.TicketEventService;
import com.poly.mhv.service.TicketService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping({"/api/tickets", "/tickets"})
@RequiredArgsConstructor
@Tag(name = "Ticket sửa chữa", description = "API tạo, phân công, xử lý và theo dõi ticket sửa chữa")
@SecurityRequirement(name = "bearerAuth")
public class TicketController {

    private final TicketService ticketService;
    private final TicketEventService ticketEventService;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('NhanVien','Admin')")
    @Operation(summary = "Tạo ticket", description = "Tạo ticket báo hỏng cho một thiết bị.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Tạo ticket thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền tạo ticket")
    })
    public ResponseEntity<TicketResponse> createTicket(@RequestBody TicketCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ticketService.createTicket(request));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('NhanVien','Admin')")
    @Operation(summary = "Tạo ticket kèm ảnh", description = "Tạo ticket báo hỏng với dữ liệu multipart/form-data và ảnh đính kèm.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Tạo ticket thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu hoặc ảnh không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền tạo ticket")
    })
    public ResponseEntity<TicketResponse> createTicketMultipart(
            @RequestParam("assetQaCode") String assetQaCode,
            @RequestParam("description") String description,
            @RequestParam("priority") String priority,
            @RequestPart(name = "image", required = false) MultipartFile image
    ) {
        TicketCreateRequest request = TicketCreateRequest.builder()
                .assetQaCode(assetQaCode)
                .description(description)
                .priority(priority)
                .build();
        return ResponseEntity.status(HttpStatus.CREATED).body(ticketService.createTicket(request, image));
    }

    @PutMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('Admin','TechSupport')")
    @Operation(summary = "Phân công ticket", description = "Gán ticket cho kỹ thuật viên phù hợp với chuyên môn thiết bị.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Phân công ticket thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu phân công không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền phân công"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy ticket hoặc người được gán")
    })
    public ResponseEntity<TicketResponse> assignTicket(
            @PathVariable Integer id,
            @RequestBody TicketAssignRequest request
    ) {
        return ResponseEntity.ok(ticketService.assignTicket(id, request));
    }

    @PutMapping("/{id}/resolve")
    @PreAuthorize("hasAnyRole('Admin','TechSupport')")
    @Operation(summary = "Hoàn tất ticket", description = "Đánh dấu ticket đã được xử lý xong.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Hoàn tất ticket thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền xử lý ticket"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy ticket")
    })
    public ResponseEntity<TicketResponse> resolveTicket(@PathVariable Integer id) {
        return ResponseEntity.ok(ticketService.resolveTicket(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('Admin','NhanVien','TechSupport')")
    @Operation(summary = "Lấy danh sách ticket", description = "Lấy danh sách ticket và lọc theo trạng thái, người tạo, người xử lý hoặc thiết bị.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy danh sách ticket thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền truy cập")
    })
    public ResponseEntity<List<TicketResponse>> getTickets(
            @RequestParam(required = false) String status,
            @RequestParam(name = "assignee_id", required = false) Integer assigneeId,
            @RequestParam(name = "asset_qa_code", required = false) String assetQaCode,
            @RequestParam(name = "reporter_id", required = false) Integer reporterId
    ) {
        return ResponseEntity.ok(ticketService.getTickets(status, assigneeId, assetQaCode, reporterId));
    }

    @GetMapping("/{id}/timeline")
    @PreAuthorize("hasAnyRole('Admin','NhanVien','TechSupport')")
    @Operation(summary = "Lấy timeline ticket", description = "Lấy các sự kiện theo dòng thời gian của một ticket.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy timeline ticket thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền truy cập"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy ticket")
    })
    public ResponseEntity<List<TicketTimelineEventResponse>> getTicketTimeline(
            @PathVariable Integer id,
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(ticketEventService.getTimeline(id, limit));
    }
}
