package com.poly.mhv.dto.ticket;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketPageResponse {
    private List<TicketResponse> items;
    private int page;
    private int size;
    private int totalPages;
    private long totalItems;
    private long pendingCount;
    private long inProgressCount;
    private long resolvedCount;
}
