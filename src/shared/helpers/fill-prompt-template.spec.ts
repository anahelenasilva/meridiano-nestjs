import { fillPromptTemplate } from './fill-prompt-template';

describe('fillPromptTemplate', () => {
  it('keeps placeholders that have no variable', () => {
    expect(fillPromptTemplate('{title}: {missing}', { title: 'News' })).toBe(
      'News: {missing}',
    );
  });

  it('keeps placeholders named after prototype keys', () => {
    expect(fillPromptTemplate('{constructor} {toString}', {})).toBe(
      '{constructor} {toString}',
    );
  });

  it('fills an undefined variable with an empty string', () => {
    expect(fillPromptTemplate('Title: {title}', { title: undefined })).toBe(
      'Title: ',
    );
  });
});
