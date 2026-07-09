import type { ChatRequest, ChatResponse } from '@aegis/shared';
import type { ChatAgent } from '../infrastructure/llm/chat-agent.js';

export class ChatUseCase {
  constructor(private readonly chatAgent: ChatAgent) {}

  async execute(request: ChatRequest): Promise<ChatResponse> {
    const answer = await this.chatAgent.processChat(request);
    
    // For now we assume if it starts with (Mock Response) it's rules based, otherwise GenAI
    // Or if it's our hardcoded translations. 
    // In a full implementation we'd check the config.
    const source = (answer.includes('(Mock Response)') || answer.includes('aseos') || answer.includes('toilettes') || answer.includes('restroom')) 
      ? 'rules' 
      : 'genai';

    return {
      answer,
      source
    };
  }
}
