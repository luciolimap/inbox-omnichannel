package com.smartspace.inbox.agent;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/agents")
public class AgentController {

    private final AgentRepository agents;

    public AgentController(AgentRepository agents) {
        this.agents = agents;
    }

    @GetMapping
    public List<AgentDto> list() {
        return agents.findAll().stream().map(AgentDto::from).toList();
    }
}
