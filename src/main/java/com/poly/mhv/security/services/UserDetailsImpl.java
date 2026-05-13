package com.poly.mhv.security.services;

import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.TechSupportType;
import java.util.Collection;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

@Data
@AllArgsConstructor
public class UserDetailsImpl implements UserDetails {

    private Integer id;
    private String username;
    private String fullName;
    private String password;
    private String role;
    private String status;
    private List<Integer> techTypeIds;
    private List<String> techTypeNames;
    private Collection<? extends GrantedAuthority> authorities;

    public static UserDetailsImpl build(AppUser appUser) {
        String authorityRole = appUser.getRole().startsWith("ROLE_")
                ? appUser.getRole()
                : "ROLE_" + appUser.getRole();
        List<TechSupportType> effectiveTechSupportTypes = appUser.getTechSupportTypes() != null
                ? appUser.getTechSupportTypes().stream()
                        .filter(type -> type != null && type.getId() != null && type.getId() > 0)
                        .toList()
                : List.of();
        List<Integer> techTypeIds = effectiveTechSupportTypes.stream().map(TechSupportType::getId).toList();
        List<String> techTypeNames = effectiveTechSupportTypes.stream().map(TechSupportType::getName).toList();
        return new UserDetailsImpl(
                appUser.getId(),
                appUser.getUsername(),
                appUser.getFullName(),
                appUser.getPassword(),
                appUser.getRole(),
                appUser.getStatus(),
                techTypeIds,
                techTypeNames,
                List.of(new SimpleGrantedAuthority(authorityRole))
        );
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return !"Khóa".equals(status);
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return "Hoạt động".equals(status);
    }
}
