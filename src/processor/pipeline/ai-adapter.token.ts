/**
 * DI token for the {@link AiAdapter} the pipeline talks to. The pipeline depends
 * on the interface, never on the concrete `AiService`; production binds this to
 * a policy-wrapped adapter, tests bind a fake.
 */
export const AI_ADAPTER = Symbol('AI_ADAPTER');
