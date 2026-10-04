package com.smartspace.inbox;

import com.smartspace.inbox.agent.Agent;
import com.smartspace.inbox.agent.AgentRepository;
import com.smartspace.inbox.agent.Role;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

    static final String PERFIL_DE_PRODUCAO = "prod";
    static final String SENHA_DE_DEMONSTRACAO = "senha123";

    // O hash BCrypt nasce aqui em vez de ficar fixo numa migracao: hash
    // commitado envelhece e ninguem sabe qual senha ele guarda.
    @Bean
    ApplicationRunner seedAgents(AgentRepository agents, PasswordEncoder encoder,
                                 Environment ambiente,
                                 @Value("${inbox.seed.admin-password}") String configurada) {
        boolean producao = ambiente.matchesProfiles(PERFIL_DE_PRODUCAO);

        return args -> {
            if (agents.count() > 0) {
                return;
            }
            // Resolvida so aqui: instancia de producao com banco ja povoado nao
            // vai semear nada, e exigir a variavel ali seria pedir um valor que
            // ninguem usa para deixar o deploy subir.
            String senha = encoder.encode(senhaDoSeed(configurada, producao));
            agents.save(new Agent("Agente Demo", "agente@smartspace.test", senha, Role.AGENT));
            agents.save(new Agent("Admin Demo", "admin@smartspace.test", senha, Role.ADMIN));
        };
    }

    // Senha conhecida no codigo seria um ADMIN publico em producao. Fora dela a
    // de demonstracao vale: subir em um comando e entrar com ela e o criterio 1.
    static String senhaDoSeed(String configurada, boolean producao) {
        // trim porque senha com espaco nas pontas e sempre dedo no teclado, e o
        // login depois exigiria o espaco exato.
        if (!configurada.isBlank()) {
            return configurada.trim();
        }
        if (producao) {
            throw new IllegalStateException(
                    "defina SEED_ADMIN_PASSWORD: com o perfil " + PERFIL_DE_PRODUCAO
                            + " ativo o seed nao usa a senha de demonstracao");
        }
        return SENHA_DE_DEMONSTRACAO;
    }
}
