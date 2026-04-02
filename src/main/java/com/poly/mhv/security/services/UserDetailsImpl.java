package com.poly.mhv.security.services;

import com.poly.mhv.entity.AppUser;
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
    private String password;
    private String role;
    private String status;
    private Integer techTypeId;
    private String techTypeName;
    private Collection<? extends GrantedAuthority> authorities;

    public static UserDetailsImpl build(AppUser appUser) {
        String authorityRole = appUser.getRole().startsWith("ROLE_")
                ? appUser.getRole()
                : "ROLE_" + appUser.getRole();
        return new UserDetailsImpl(
                appUser.getId(),
                appUser.getUsername(),
                appUser.getPassword(),
                appUser.getRole(),
                appUser.getStatus(),
                appUser.getTechSupportType() != null ? appUser.getTechSupportType().getId() : 0,
                appUser.getTechSupportType() != null ? appUser.getTechSupportType().getName() : null,
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
