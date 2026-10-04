package com.smartspace.inbox.auth;

import com.smartspace.inbox.agent.AgentDto;

public record LoginResponse(String token, AgentDto agent) {
}
