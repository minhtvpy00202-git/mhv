package com.poly.mhv.service;

import com.poly.mhv.dto.location.LocationResponse;
import com.poly.mhv.repository.LocationRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LocationService {

    private final LocationRepository locationRepository;

    public LocationService(LocationRepository locationRepository) {
        this.locationRepository = locationRepository;
    }

    @Transactional(readOnly = true)
    public List<LocationResponse> getAllLocations() {
        return locationRepository.findAll().stream()
                .map(location -> LocationResponse.builder()
                        .id(location.getId())
                        .roomName(location.getRoomName())
                        .build())
                .sorted((a, b) -> a.getRoomName().compareToIgnoreCase(b.getRoomName()))
                .toList();
    }
}
