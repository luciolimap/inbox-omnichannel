package com.smartspace.inbox.agent;

public record AgentDto(Long id, String name, String email, String role) {

    public static AgentDto from(Agent agent) {
        return new AgentDto(agent.getId(), agent.getName(), agent.getEmail(), agent.getRole().name());
    }
}
