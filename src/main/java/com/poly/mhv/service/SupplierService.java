package com.poly.mhv.service;

import com.poly.mhv.dto.supplier.SupplierCreateRequest;
import com.poly.mhv.dto.supplier.SupplierResponse;
import com.poly.mhv.dto.supplier.SupplierUpdateRequest;
import com.poly.mhv.entity.Supplier;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.SupplierRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final AssetRepository assetRepository;

    public SupplierService(SupplierRepository supplierRepository, AssetRepository assetRepository) {
        this.supplierRepository = supplierRepository;
        this.assetRepository = assetRepository;
    }

    @Transactional(readOnly = true)
    public List<SupplierResponse> getAll(String keyword) {
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        List<Supplier> suppliers = supplierRepository.searchForAdmin(normalizedKeyword);
        Map<Integer, Long> assetCountsBySupplierId = buildAssetCountMap(suppliers);
        return suppliers.stream()
                .map(supplier -> mapToResponse(supplier, assetCountsBySupplierId))
                .toList();
    }

    @Transactional(readOnly = true)
    public SupplierResponse getById(Integer id) {
        return mapToResponse(getSupplierOrThrow(id));
    }

    @Transactional
    public SupplierResponse create(SupplierCreateRequest request) {
        String normalizedName = normalizeName(request.getName());
        if (supplierRepository.existsByNameIgnoreCase(normalizedName)) {
            throw new CustomException("Tên nhà cung cấp đã tồn tại.");
        }
        Supplier supplier = Supplier.builder()
                .name(normalizedName)
                .address(normalizeAddress(request.getAddress()))
                .phoneNumber(normalizePhoneNumber(request.getPhoneNumber()))
                .build();
        return mapToResponse(supplierRepository.save(supplier));
    }

    @Transactional
    public SupplierResponse update(Integer id, SupplierUpdateRequest request) {
        Supplier supplier = getSupplierOrThrow(id);
        String normalizedName = normalizeName(request.getName());
        if (supplierRepository.existsByNameIgnoreCaseAndIdNot(normalizedName, id)) {
            throw new CustomException("Tên nhà cung cấp đã tồn tại.");
        }
        supplier.setName(normalizedName);
        supplier.setAddress(normalizeAddress(request.getAddress()));
        supplier.setPhoneNumber(normalizePhoneNumber(request.getPhoneNumber()));
        return mapToResponse(supplierRepository.save(supplier));
    }

    @Transactional
    public void delete(Integer id) {
        Supplier supplier = getSupplierOrThrow(id);
        long linkedAssets = assetRepository.countBySupplierId(id);
        if (linkedAssets > 0) {
            throw new CustomException("Không thể xóa nhà cung cấp đang được gán cho " + linkedAssets + " thiết bị.");
        }
        supplierRepository.delete(supplier);
    }

    private Supplier getSupplierOrThrow(Integer id) {
        if (id == null || id <= 0) {
            throw new CustomException("Không tìm thấy nhà cung cấp.");
        }
        return supplierRepository.findById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy nhà cung cấp với id: " + id));
    }

    private String normalizeName(String name) {
        String normalizedName = name == null ? null : name.trim();
        if (!StringUtils.hasText(normalizedName)) {
            throw new CustomException("Tên nhà cung cấp là bắt buộc.");
        }
        return normalizedName;
    }

    private String normalizeAddress(String address) {
        String normalizedAddress = address == null ? null : address.trim();
        if (!StringUtils.hasText(normalizedAddress)) {
            throw new CustomException("Địa chỉ nhà cung cấp là bắt buộc.");
        }
        return normalizedAddress;
    }

    private String normalizePhoneNumber(String phoneNumber) {
        String normalizedPhoneNumber = phoneNumber == null ? null : phoneNumber.trim();
        if (!StringUtils.hasText(normalizedPhoneNumber)) {
            throw new CustomException("Số điện thoại nhà cung cấp là bắt buộc.");
        }
        return normalizedPhoneNumber;
    }

    private Map<Integer, Long> buildAssetCountMap(List<Supplier> suppliers) {
        List<Integer> supplierIds = suppliers.stream()
                .map(Supplier::getId)
                .toList();
        if (supplierIds.isEmpty()) {
            return Map.of();
        }
        return supplierRepository.countAssetsBySupplierIds(supplierIds).stream()
                .collect(Collectors.toMap(
                        row -> (Integer) row[0],
                        row -> (Long) row[1]
                ));
    }

    private SupplierResponse mapToResponse(Supplier supplier) {
        return mapToResponse(
                supplier,
                Map.of(supplier.getId(), assetRepository.countBySupplierId(supplier.getId()))
        );
    }

    private SupplierResponse mapToResponse(Supplier supplier, Map<Integer, Long> assetCountsBySupplierId) {
        return SupplierResponse.builder()
                .id(supplier.getId())
                .name(supplier.getName())
                .address(supplier.getAddress())
                .phoneNumber(supplier.getPhoneNumber())
                .assetCount(assetCountsBySupplierId.getOrDefault(supplier.getId(), 0L))
                .build();
    }
}
