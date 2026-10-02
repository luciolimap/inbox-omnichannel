package com.smartspace.inbox;

import com.smartspace.inbox.agent.Agent;
import com.smartspace.inbox.agent.AgentRepository;
import com.smartspace.inbox.agent.Role;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

    // O hash BCrypt nasce aqui em vez de ficar fixo numa migracao: hash
    // commitado envelhece e ninguem sabe qual senha ele guarda.
    @Bean
    ApplicationRunner seedAgents(AgentRepository agents, PasswordEncoder encoder) {
        return args -> {
            if (agents.count() > 0) {
                return;
            }
            String senha = encoder.encode("senha123");
            agents.save(new Agent("Agente Demo", "agente@smartspace.test", senha, Role.AGENT));
            agents.save(new Agent("Admin Demo", "admin@smartspace.test", senha, Role.ADMIN));
        };
    }
}
