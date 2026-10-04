package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.Agent;
import com.smartspace.inbox.gateway.GatewayClient;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

    private final ConversationService service;
    private final GatewayClient gateway;

    public ConversationController(ConversationService service, GatewayClient gateway) {
        this.service = service;
        this.gateway = gateway;
    }

    @GetMapping
    public List<ConversationSummary> list(@RequestParam(required = false) ConversationStatus status) {
        return service.list(status);
    }

    @GetMapping("/{id}")
    public ConversationDetail detail(@PathVariable Long id) {
        return service.detail(id);
    }

    // A orquestracao vive no controlador de proposito. Chamar o gateway de dentro
    // de um metodo @Transactional seguraria a conexao do banco durante um HTTP
    // externo; e chamar um metodo @Transactional do mesmo bean nao passa pelo
    // proxy do Spring, entao a transacao nem existiria.
    @PostMapping("/{id}/messages")
    public ResponseEntity<MessageDto> reply(@PathVariable Long id,
                                            @Valid @RequestBody ReplyRequest request,
                                            @AuthenticationPrincipal Agent agent) {
        ReplyPrepared preparada = service.persistReply(id, request, agent);

        boolean entregue = gateway.dispatch(
                preparada.channel(), preparada.externalContactId(), request.body());

        MessageDto salva = service.markDelivery(
                preparada.message().id(), entregue ? DeliveryStatus.SENT : DeliveryStatus.FAILED);

        HttpStatus status = entregue ? HttpStatus.CREATED : HttpStatus.BAD_GATEWAY;
        return ResponseEntity.status(status).body(salva);
    }

    @PatchMapping("/{id}/assign")
    public ConversationDetail assign(@PathVariable Long id, @Valid @RequestBody AssignRequest request) {
        return service.assign(id, request.agentId());
    }

    @PatchMapping("/{id}/status")
    public ConversationDetail status(@PathVariable Long id, @Valid @RequestBody StatusRequest request) {
        return service.changeStatus(id, request.status());
    }
}
