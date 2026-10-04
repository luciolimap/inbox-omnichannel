package com.smartspace.inbox.auth;

import com.smartspace.inbox.agent.Agent;
import com.smartspace.inbox.agent.AgentDto;
import com.smartspace.inbox.agent.AgentRepository;
import com.smartspace.inbox.error.ApiError;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AgentRepository agents;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthController(AgentRepository agents, PasswordEncoder encoder, JwtService jwt) {
        this.agents = agents;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        Optional<Agent> encontrado = agents.findByEmail(request.email())
                .filter(agent -> encoder.matches(request.password(), agent.getPasswordHash()));

        // Uma resposta so para e-mail inexistente e para senha errada: dizer qual
        // dos dois falhou entrega lista de e-mails validos a quem testa em massa.
        if (encontrado.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiError("credenciais_invalidas", "e-mail ou senha incorretos"));
        }

        Agent agent = encontrado.get();
        return ResponseEntity.ok(new LoginResponse(jwt.generate(agent), AgentDto.from(agent)));
    }
}
