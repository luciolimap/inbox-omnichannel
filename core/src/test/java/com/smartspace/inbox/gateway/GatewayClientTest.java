package com.smartspace.inbox.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartspace.inbox.conversation.Channel;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GatewayClientTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void corpo_com_quebra_de_linha_sai_como_json_valido() throws Exception {
        String json = GatewayClient.payload(Channel.TELEGRAM, "chat-1", "linha um\nlinha dois");

        assertThat(mapper.readTree(json).get("body").asText()).isEqualTo("linha um\nlinha dois");
    }

    @Test
    void contato_com_aspas_nao_quebra_o_payload() throws Exception {
        String json = GatewayClient.payload(Channel.WHATSAPP, "chat\"-2", "oi");

        var arvore = mapper.readTree(json);
        assertThat(arvore.get("externalContactId").asText()).isEqualTo("chat\"-2");
        assertThat(arvore.get("channel").asText()).isEqualTo("WHATSAPP");
    }
}
