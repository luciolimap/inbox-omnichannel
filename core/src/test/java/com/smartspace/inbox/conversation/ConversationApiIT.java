package com.smartspace.inbox.conversation;

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

    private Conversation criarConversaCom(String texto) {
        Contact contact = contacts.save(new Contact(
                Channel.TELEGRAM, "chat-" + System.nanoTime(), "Cliente Teste"));
        Conversation conversa = new Conversation(contact);
        conversa.addMessage(Message.inbound(texto, "telegram:" + System.nanoTime()));
        return conversations.save(conversa);
    }
}
