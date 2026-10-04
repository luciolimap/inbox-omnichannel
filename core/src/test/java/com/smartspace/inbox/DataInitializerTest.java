package com.smartspace.inbox;

import com.smartspace.inbox.agent.AgentRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DataInitializerTest {

    @Test
    void fora_de_producao_sem_variavel_usa_a_senha_de_demonstracao() {
        assertThat(DataInitializer.senhaDoSeed("", false)).isEqualTo("senha123");
    }

    @Test
    void fora_de_producao_com_variavel_usa_a_do_ambiente() {
        assertThat(DataInitializer.senhaDoSeed("outra-senha", false)).isEqualTo("outra-senha");
    }

    @Test
    void em_producao_com_variavel_usa_a_do_ambiente() {
        assertThat(DataInitializer.senhaDoSeed("senha-de-producao", true))
                .isEqualTo("senha-de-producao");
    }

    @Test
    void em_producao_sem_variavel_falha_dizendo_o_que_falta() {
        assertThatThrownBy(() -> DataInitializer.senhaDoSeed("  ", true))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SEED_ADMIN_PASSWORD");
    }

    @Test
    void espaco_nas_pontas_sai_da_senha() {
        assertThat(DataInitializer.senhaDoSeed("  com-espaco  ", true)).isEqualTo("com-espaco");
    }
    // O teste da regra nao pega dois erros silenciosos: nome da propriedade
    // digitado errado no application.yml, e a deteccao de producao que depende
    // do perfil ativo. Este sobe o bean de verdade, sem banco.
    private final ApplicationContextRunner contexto = new ApplicationContextRunner()
            .withUserConfiguration(DataInitializer.class, DependenciasFalsas.class)
            .withPropertyValues("inbox.seed.admin-password:${SEED_ADMIN_PASSWORD:}");

    @Test
    void com_perfil_prod_e_banco_vazio_o_seed_exige_a_variavel() {
        contexto.withPropertyValues("spring.profiles.active=prod").run(ctx -> {
            assertThat(ctx).hasNotFailed();
            when(ctx.getBean(AgentRepository.class).count()).thenReturn(0L);

            assertThatThrownBy(() -> ctx.getBean(ApplicationRunner.class).run(null))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("SEED_ADMIN_PASSWORD");
        });
    }

    @Test
    void com_perfil_prod_e_banco_povoado_o_deploy_sobe_sem_a_variavel() {
        contexto.withPropertyValues("spring.profiles.active=prod").run(ctx -> {
            when(ctx.getBean(AgentRepository.class).count()).thenReturn(2L);

            assertThatCode(() -> ctx.getBean(ApplicationRunner.class).run(null))
                    .doesNotThrowAnyException();
        });
    }

    @Test
    void sem_perfil_prod_o_seed_roda_com_a_senha_de_demonstracao() {
        contexto.run(ctx -> {
            when(ctx.getBean(AgentRepository.class).count()).thenReturn(0L);

            assertThatCode(() -> ctx.getBean(ApplicationRunner.class).run(null))
                    .doesNotThrowAnyException();
        });
    }

    @Configuration
    static class DependenciasFalsas {

        @Bean
        AgentRepository agents() {
            return mock(AgentRepository.class);
        }

        @Bean
        PasswordEncoder encoder() {
            return new BCryptPasswordEncoder();
        }
    }
}
