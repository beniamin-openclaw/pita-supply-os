// Text matcher for strings whose units are wrapped in <UnitLabel> spans: the
// default getByText compares one element's own text nodes, so a sentence split
// across spans never matches. This matches the innermost element whose full
// textContent equals `text` (or matches the regex).
export function innermostText(text: string | RegExp): (content: string, el: Element | null) => boolean {
  const matches = (s: string): boolean =>
    typeof text === "string" ? s === text : text.test(s);
  return (_content, el) =>
    el !== null &&
    matches(el.textContent ?? "") &&
    !Array.from(el.children).some((c) => matches(c.textContent ?? ""));
}
