package com.smartspace.inbox.auth;

import com.smartspace.inbox.agent.AgentRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwt;
    private final AgentRepository agents;

    public JwtAuthFilter(JwtService jwt, AgentRepository agents) {
        this.jwt = jwt;
        this.agents = agents;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            jwt.subjectOf(header.substring(7))
                    .flatMap(agents::findByEmail)
                    .ifPresent(agent -> {
                        var authority = new SimpleGrantedAuthority("ROLE_" + agent.getRole().name());
                        var auth = new UsernamePasswordAuthenticationToken(
                                agent, null, List.of(authority));
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    });
        }
        chain.doFilter(request, response);
    }
}
