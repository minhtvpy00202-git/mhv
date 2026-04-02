package com.poly.mhv.controller;

import com.poly.mhv.dto.ticket.TicketAssignRequest;
import com.poly.mhv.dto.ticket.TicketCreateRequest;
import com.poly.mhv.dto.ticket.TicketResponse;
import com.poly.mhv.service.TicketService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class TicketController {

    private final TicketService ticketService;

    @PostMapping
    @PreAuthorize("hasAnyRole('NhanVien','Admin')")
    public ResponseEntity<TicketResponse> createTicket(@RequestBody TicketCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ticketService.createTicket(request));
    }

    @PutMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('Admin','TechSupport')")
    public ResponseEntity<TicketResponse> assignTicket(
            @PathVariable Integer id,
            @RequestBody TicketAssignRequest request
    ) {
        return ResponseEntity.ok(ticketService.assignTicket(id, request));
    }

    @PutMapping("/{id}/resolve")
    @PreAuthorize("hasAnyRole('Admin','TechSupport')")
    public ResponseEntity<TicketResponse> resolveTicket(@PathVariable Integer id) {
        return ResponseEntity.ok(ticketService.resolveTicket(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('Admin','NhanVien','TechSupport')")
    public ResponseEntity<List<TicketResponse>> getTickets(
            @RequestParam(required = false) String status,
            @RequestParam(name = "assignee_id", required = false) Integer assigneeId,
            @RequestParam(name = "asset_qa_code", required = false) String assetQaCode
    ) {
        return ResponseEntity.ok(ticketService.getTickets(status, assigneeId, assetQaCode));
    }
}
