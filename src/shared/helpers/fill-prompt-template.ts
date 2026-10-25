// Values go in literally and are never rescanned, so scraped text with `$&`
// or `{placeholder}` in it stays as written. Unknown placeholders are kept.
export function fillPromptTemplate(
  template: string,
  variables: Record<string, string | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.hasOwn(variables, key) ? (variables[key] ?? '') : placeholder,
  );
}
