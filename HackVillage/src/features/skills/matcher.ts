export type SkillMode = 'exchange' | 'collaboration' | 'learning';
export type Skills = { have: string[]; want: string[]; need: string[] };
export type Coverage = { score: number | null; matched: string[]; unmatched: string[] };
export type SkillMatch = {
  score: number | null;
  a_to_b: Coverage;
  b_to_a: Coverage;
  match_type: 'mutual' | 'one_direction' | 'no_match' | 'insufficient_data';
  is_mutual: boolean;
};
const aliases: Record<string, string> = {
  js: 'javascript', ts: 'typescript', ml: 'machine learning', ai: 'artificial intelligence',
  postgres: 'postgresql', nodejs: 'node.js', reactjs: 'react', 'react.js': 'react',
  'c sharp': 'c#', 'c-sharp': 'c#', dotnet: '.net', k8s: 'kubernetes',
  aws: 'amazon web services', html5: 'html', css3: 'css',
};
export function readSkills(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Enter up to 100 skills.');
  const skills = value.map(item => {
    if (typeof item !== 'string' || item.length > 100) throw new Error('Skills must be text of at most 100 characters.');
    const clean = item.trim().toLowerCase();
    return aliases[clean] ?? clean;
  });
  return [...new Set(skills.filter(Boolean))];
}
function roundOne(value: number): number {
  // Match Python round(value, 1), including binary floating-point ties-to-even.
  const bytes = new DataView(new ArrayBuffer(8));
  bytes.setFloat64(0, value);
  const bits = bytes.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 2047n) - 1023 - 52;
  const numerator = ((bits & ((1n << 52n) - 1n)) | (1n << 52n)) * 10n;
  if (value === 0) return 0;
  if (exponent >= 0) return Number(numerator << BigInt(exponent)) / 10;
  const denominator = 1n << BigInt(-exponent);
  let quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder * 2n > denominator || (remainder * 2n === denominator && quotient % 2n === 1n)) quotient++;
  return Number(quotient) / 10;
}
function coverage(have: string[], needed: string[]): Coverage {
  const matched = needed.filter(skill => have.includes(skill)).sort();
  return { score: needed.length ? roundOne(matched.length / needed.length * 100) : null,
    matched, unmatched: needed.filter(skill => !have.includes(skill)).sort() };
}
// Same formulas, aliases, missing-data behavior, and reciprocity metadata as the Python matcher.
export function calculateSkillMatch(a: Skills, b: Skills, mode: SkillMode): SkillMatch {
  if (!['exchange', 'collaboration', 'learning'].includes(mode)) throw new Error('Unknown skill mode.');
  const ah = readSkills(a.have), aw = readSkills(a.want), an = readSkills(a.need);
  const bh = readSkills(b.have), bw = readSkills(b.want), bn = readSkills(b.need);
  const ab = mode === 'learning' ? coverage(aw, bw) : coverage(ah, mode === 'exchange' ? bw : bn);
  const ba = mode === 'learning' ? coverage(bw, aw) : coverage(bh, mode === 'exchange' ? aw : an);
  const scores = [ab.score, ba.score].filter((score): score is number => score !== null);
  const positive = scores.filter(score => score > 0).length;
  const match_type = positive === 2 ? 'mutual' : positive === 1 ? 'one_direction' : scores.length === 2 ? 'no_match' : 'insufficient_data';
  return { score: scores.length ? roundOne(scores.reduce((sum, n) => sum + n, 0) / scores.length) : null,
    a_to_b: ab, b_to_a: ba, match_type, is_mutual: match_type === 'mutual' };
}
