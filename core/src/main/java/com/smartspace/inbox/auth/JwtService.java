package com.smartspace.inbox.auth;

import com.smartspace.inbox.agent.Agent;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

@Service
public class JwtService {

    private final SecretKey key;
    private final Duration ttl;

    public JwtService(@Value("${inbox.jwt.secret}") String secret,
                      @Value("${inbox.jwt.ttl-minutes}") long ttlMinutes) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttl = Duration.ofMinutes(ttlMinutes);
    }

    public String generate(Agent agent) {
        Instant agora = Instant.now();
        return Jwts.builder()
                .subject(agent.getEmail())
                .claim("role", agent.getRole().name())
                .claim("agentId", agent.getId())
                .issuedAt(Date.from(agora))
                .expiration(Date.from(agora.plus(ttl)))
                .signWith(key)
                .compact();
    }

    public Optional<String> subjectOf(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Optional.ofNullable(claims.getSubject());
            // Token expirado, assinado com outra chave ou truncado chega aqui. A
            // decisao de responder 401 e do filtro; o servico so diz "nao vale".
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
