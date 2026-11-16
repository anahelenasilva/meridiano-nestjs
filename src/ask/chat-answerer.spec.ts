import { mock } from 'jest-mock-extended';
import { AiService } from '../ai/ai.service';
import { ChatAnswerer } from './chat-answerer';

describe('ChatAnswerer', () => {
  it('sends the source text, prior turns and question to the chosen chat model and returns its answer', async () => {
    const aiService = mock<AiService>();
    aiService.callChatModelOrThrow.mockResolvedValue('The guest said X.');
    const answerer = new ChatAnswerer(aiService);

    const answer = await answerer.answer({
      model: 'openai',
      sourceTitle: 'Interview with a guest',
      sourceText: 'The guest talked about X at length.',
      history: [{ question: 'Who is the guest?', answer: 'A researcher.' }],
      question: 'What did the guest say about X?',
    });

    expect(answer).toBe('The guest said X.');
    const [model, prompt, systemPrompt] =
      aiService.callChatModelOrThrow.mock.calls[0];
    expect(model).toBe('openai');
    expect(prompt).toContain('Interview with a guest');
    expect(prompt).toContain('The guest talked about X at length.');
    expect(prompt).toContain('Who is the guest?');
    expect(prompt).toContain('A researcher.');
    expect(prompt).toContain('What did the guest say about X?');
    expect(systemPrompt).toEqual(expect.any(String));
  });
});
