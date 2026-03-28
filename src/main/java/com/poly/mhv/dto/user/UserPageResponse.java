package com.poly.mhv.dto.user;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserPageResponse {
    private List<UserAdminResponse> items;
    private int page;
    private int size;
    private int totalPages;
    private long totalItems;
}
