package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.AgentRepository;
import com.smartspace.inbox.contact.Contact;
import com.smartspace.inbox.contact.ContactRepository;
import com.smartspace.inbox.support.PostgresIT;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Rollback por teste pelo mesmo motivo do ConversationRepositoryIT: a assercao
// de $[0] depende de nenhuma conversa de outro teste estar mais recente.
@Transactional
@AutoConfigureMockMvc
class ConversationApiIT extends PostgresIT {

    @Autowired
    MockMvc mvc;

    @Autowired
    ContactRepository contacts;

    @Autowired
    ConversationRepository conversations;

    @Autowired
    AgentRepository agents;

    String token;

    @BeforeEach
    void autentica() throws Exception {
        String corpo = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"agente@smartspace.test","password":"senha123"}"""))
                .andReturn().getResponse().getContentAsString();
        token = corpo.replaceAll(".*\"token\"\s*:\s*\"([^\"]+)\".*", "$1");
    }

    @Test
    void lista_traz_resumo_com_previa_da_ultima_mensagem() throws Exception {
        criarConversaCom("oi, preciso de ajuda");

        mvc.perform(get("/api/conversations").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].channel").value("TELEGRAM"))
                .andExpect(jsonPath("$[0].status").value("OPEN"))
                .andExpect(jsonPath("$[0].lastMessagePreview").value("oi, preciso de ajuda"));
    }

    @Test
    void filtro_por_status_nao_traz_conversa_de_outro_status() throws Exception {
        Conversation resolvida = criarConversaCom("resolvida");
        resolvida.setStatus(ConversationStatus.RESOLVED);
        conversations.save(resolvida);

        mvc.perform(get("/api/conversations?status=OPEN")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + resolvida.getId() + ")]").isEmpty());
    }

    @Test
    void detalhe_traz_as_mensagens_em_ordem() throws Exception {
        Conversation conversa = criarConversaCom("primeira");
        conversa.addMessage(Message.inbound("segunda", "telegram:999"));
        conversations.save(conversa);

        mvc.perform(get("/api/conversations/" + conversa.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages[0].body").value("primeira"))
                .andExpect(jsonPath("$.messages[1].body").value("segunda"));
    }

    @Test
    void detalhe_de_conversa_inexistente_devolve_404() throws Exception {
        mvc.perform(get("/api/conversations/99999").header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("not_found"));
    }

    @Test
    void responder_com_corpo_vazio_devolve_400() throws Exception {
        Conversation conversa = criarConversaCom("oi");

        mvc.perform(post("/api/conversations/" + conversa.getId() + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"body":"   "}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("requisicao_invalida"));
    }

    @Test
    void responder_acima_de_4096_caracteres_devolve_400() throws Exception {
        Conversation conversa = criarConversaCom("oi");
        String gigante = "a".repeat(4097);

        mvc.perform(post("/api/conversations/" + conversa.getId() + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + gigante + "\"}"))
                .andExpect(status().isBadRequest());
    }

    // O gateway nao existe na suite, entao todo despacho falha de verdade. E
    // exatamente o cenario que se quer provar: a resposta do agente nao se perde.
    @Test
    void gateway_fora_do_ar_salva_a_mensagem_como_falha_e_devolve_502() throws Exception {
        Conversation conversa = criarConversaCom("oi");

        mvc.perform(post("/api/conversations/" + conversa.getId() + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"body":"ja estou vendo"}"""))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.deliveryStatus").value("FAILED"))
                .andExpect(jsonPath("$.body").value("ja estou vendo"));

        mvc.perform(get("/api/conversations/" + conversa.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.messages[1].body").value("ja estou vendo"))
                .andExpect(jsonPath("$.messages[1].deliveryStatus").value("FAILED"));
    }

    @Test
    void atribuir_e_resolver_persistem() throws Exception {
        Conversation conversa = criarConversaCom("oi");
        Long agenteId = agents.findByEmail("agente@smartspace.test").orElseThrow().getId();

        mvc.perform(patch("/api/conversations/" + conversa.getId() + "/assign")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"agentId\":" + agenteId + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignedAgent.name").value("Agente Demo"));

        mvc.perform(patch("/api/conversations/" + conversa.getId() + "/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"RESOLVED"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVED"));

        mvc.perform(get("/api/conversations/" + conversa.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.status").value("RESOLVED"))
                .andExpect(jsonPath("$.assignedAgent.email").value("agente@smartspace.test"));
    }

    private Conversation criarConversaCom(String texto) {
        Contact contact = contacts.save(new Contact(
                Channel.TELEGRAM, "chat-" + System.nanoTime(), "Cliente Teste"));
        Conversation conversa = new Conversation(contact);
        conversa.addMessage(Message.inbound(texto, "telegram:" + System.nanoTime()));
        return conversations.save(conversa);
    }
}
