/** Numbers in a sentence, ignoring trailing punctuation. */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,.]*/g) ?? []).map((token) => token.replace(/[.,]$/, ""));
}

/** Numbers that do not appear in any of the supporting facts. */
export function unsupportedNumbers(text: string, supportingValues: string[]): string[] {
  const haystack = supportingValues.join(" ").replace(/\s+/g, " ").toLowerCase();
  return numbersIn(text).filter((number) => !haystack.includes(number.toLowerCase()));
}
