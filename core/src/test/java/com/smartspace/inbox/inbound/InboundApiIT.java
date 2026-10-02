package com.smartspace.inbox.inbound;

import com.smartspace.inbox.conversation.ConversationRepository;
import com.smartspace.inbox.conversation.ConversationStatus;
import com.smartspace.inbox.conversation.MessageRepository;
import com.smartspace.inbox.support.PostgresIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class InboundApiIT extends PostgresIT {

    private static final String TOKEN = "token-interno-de-desenvolvimento";

    @Autowired
    MockMvc mvc;

    @Autowired
    ConversationRepository conversations;

    @Autowired
    MessageRepository messages;

    @Test
    void mensagem_de_canal_cria_contato_e_conversa() throws Exception {
        mvc.perform(inbound("chat-100", "telegram:100", "oi, preciso de ajuda"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.direction").value("INBOUND"))
                .andExpect(jsonPath("$.body").value("oi, preciso de ajuda"));

        assertThat(conversations.findAllByOrderByLastMessageAtDesc())
                .anySatisfy(conversa -> {
                    assertThat(conversa.getContact().getExternalId()).isEqualTo("chat-100");
                    assertThat(conversa.getStatus()).isEqualTo(ConversationStatus.OPEN);
                });
    }

    @Test
    void segunda_mensagem_do_mesmo_contato_cai_na_mesma_conversa() throws Exception {
        mvc.perform(inbound("chat-200", "telegram:200", "primeira")).andExpect(status().isOk());
        mvc.perform(inbound("chat-200", "telegram:201", "segunda")).andExpect(status().isOk());

        long quantas = conversations.findAllByOrderByLastMessageAtDesc().stream()
                .filter(c -> c.getContact().getExternalId().equals("chat-200"))
                .count();
        assertThat(quantas).isEqualTo(1);
    }

    @Test
    void mensagem_depois_de_resolvida_abre_conversa_nova() throws Exception {
        mvc.perform(inbound("chat-300", "telegram:300", "primeira")).andExpect(status().isOk());

        var conversa = conversations.findAllByOrderByLastMessageAtDesc().stream()
                .filter(c -> c.getContact().getExternalId().equals("chat-300"))
                .findFirst().orElseThrow();
        conversa.setStatus(ConversationStatus.RESOLVED);
        conversations.save(conversa);

        mvc.perform(inbound("chat-300", "telegram:301", "voltei")).andExpect(status().isOk());

        long quantas = conversations.findAllByOrderByLastMessageAtDesc().stream()
                .filter(c -> c.getContact().getExternalId().equals("chat-300"))
                .count();
        assertThat(quantas).isEqualTo(2);
    }

    @Test
    void sem_token_interno_devolve_401() throws Exception {
        mvc.perform(post("/internal/inbound")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"channel":"TELEGRAM","externalContactId":"x",
                                 "externalMessageId":"telegram:1","body":"oi"}"""))
                .andExpect(status().isUnauthorized());
    }

    // Conversation.messages e LAZY. Sem sessao aberta, le-lo depois da chamada
    // HTTP estoura LazyInitializationException antes de chegar na assercao.
    @Transactional
    @Test
    void reentrega_do_mesmo_external_id_nao_duplica_mensagem() throws Exception {
        mvc.perform(inbound("chat-400", "telegram:400", "oi")).andExpect(status().isOk());
        mvc.perform(inbound("chat-400", "telegram:400", "oi")).andExpect(status().isOk());

        assertThat(messages.findByExternalId("telegram:400")).isPresent();

        var conversa = conversations.findAllByOrderByLastMessageAtDesc().stream()
                .filter(c -> c.getContact().getExternalId().equals("chat-400"))
                .findFirst().orElseThrow();

        assertThat(conversa.getMessages()).hasSize(1);
    }

    @Test
    void corpo_vazio_devolve_400_e_nao_cria_conversa() throws Exception {
        mvc.perform(inbound("chat-500", "telegram:500", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("requisicao_invalida"));

        assertThat(conversations.findAllByOrderByLastMessageAtDesc())
                .noneMatch(c -> c.getContact().getExternalId().equals("chat-500"));
    }

    private static org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder inbound(
            String contato, String externalMessageId, String corpo) {
        return post("/internal/inbound")
                .header("X-Internal-Token", TOKEN)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"channel":"TELEGRAM","externalContactId":"%s","contactName":"Cliente",
                         "externalMessageId":"%s","body":"%s"}"""
                        .formatted(contato, externalMessageId, corpo));
    }
}
