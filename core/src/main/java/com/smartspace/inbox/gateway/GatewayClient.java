package com.smartspace.inbox.gateway;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartspace.inbox.conversation.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@Component
public class GatewayClient {

    private static final Logger log = LoggerFactory.getLogger(GatewayClient.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    // HTTP/1.1 fixo: no padrao HTTP_2 o cliente tenta upgrade h2c, que o servidor
    // Node do gateway nao fala, e o POST chega com o corpo descasado do
    // Content-Length (FST_ERR_CTP_INVALID_CONTENT_LENGTH no Fastify).
    private final HttpClient http = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(3))
            .build();
    private final String gatewayUrl;
    private final String internalToken;

    public GatewayClient(@Value("${inbox.gateway-url}") String gatewayUrl,
                         @Value("${inbox.internal-token}") String internalToken) {
        this.gatewayUrl = gatewayUrl;
        this.internalToken = internalToken;
    }

    // Devolve boolean em vez de lancar: quem chama precisa gravar FAILED na
    // mensagem que ja esta no banco, e excecao atravessando a transacao
    // apagaria exatamente o registro que o agente precisa ver.
    public boolean dispatch(Channel channel, String externalContactId, String body) {
        String json = payload(channel, externalContactId, body);
        HttpRequest request = HttpRequest.newBuilder(URI.create(gatewayUrl + "/internal/dispatch"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .header("X-Internal-Token", internalToken)
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
        try {
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return true;
            }
            log.warn("gateway recusou o despacho: {} {}", response.statusCode(), response.body());
            return false;
        } catch (Exception e) {
            log.warn("gateway inacessivel: {}", e.getMessage());
            return false;
        }
    }

    // Jackson em vez de montar o JSON por formatted: o escape escrito a mao
    // trocava "\n" pelo mesmo caractere, porque em Java "\n" no fonte ja e a
    // quebra de linha, e o externalContactId nem passava por escape nenhum.
    static String payload(Channel channel, String externalContactId, String body) {
        try {
            return MAPPER.writeValueAsString(Map.of(
                    "channel", channel.name(),
                    "externalContactId", externalContactId,
                    "body", body));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("payload de dispatch nao serializa", e);
        }
    }
}
