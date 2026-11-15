/**
 * DI token for the {@link Answerer} `AskService` talks to. Production binds
 * `ChatAnswerer`; a web-search answerer can replace it later without touching
 * the endpoint or the panel (issue #390).
 */
export const ANSWERER = Symbol('ANSWERER');

export interface AskTurn {
  question: string;
  answer: string;
}

export interface AnswerInput {
  sourceTitle: string;
  sourceText: string;
  history: AskTurn[];
  question: string;
}

export interface Answerer {
  answer(input: AnswerInput): Promise<string>;
}
