package com.smartspace.inbox.auth;

import com.smartspace.inbox.support.PostgresIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class AuthControllerIT extends PostgresIT {

    @Autowired
    MockMvc mvc;

    @Test
    void login_com_credencial_correta_devolve_token() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"agente@smartspace.test","password":"senha123"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.agent.role").value("AGENT"));
    }

    @Test
    void login_com_senha_errada_devolve_401() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"agente@smartspace.test","password":"errada"}"""))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("credenciais_invalidas"));
    }

    @Test
    void rota_protegida_sem_token_devolve_401() throws Exception {
        mvc.perform(get("/api/agents")).andExpect(status().isUnauthorized());
    }

    @Test
    void rota_protegida_com_token_valido_devolve_200() throws Exception {
        String token = tokenDoAgente();
        mvc.perform(get("/api/agents").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void token_invalido_devolve_401_com_json_e_nao_500() throws Exception {
        mvc.perform(get("/api/agents").header("Authorization", "Bearer nao-e-um-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("nao_autenticado"));
    }

    @Test
    void token_assinado_com_outra_chave_devolve_401() throws Exception {
        String outro = io.jsonwebtoken.Jwts.builder()
                .subject("agente@smartspace.test")
                .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(
                        "uma-chave-diferente-com-mais-de-32-caracteres".getBytes()))
                .compact();

        mvc.perform(get("/api/agents").header("Authorization", "Bearer " + outro))
                .andExpect(status().isUnauthorized());
    }

    private String tokenDoAgente() throws Exception {
        String corpo = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"agente@smartspace.test","password":"senha123"}"""))
                .andReturn().getResponse().getContentAsString();
        return corpo.replaceAll(".*\"token\"\s*:\s*\"([^\"]+)\".*", "$1");
    }
}
