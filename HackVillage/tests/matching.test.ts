import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readUserCode, exactTextInterests } from '../src/features/interests/interest_data';
import { calculateInterestMatch } from '../src/features/interests/interest_matcher';
import { createDiscoveryHandler } from '../src/features/interests/discovery';
import { calculateSkillMatch, type Skills } from '../src/features/skills/matcher';
import { createLineDecoder, parseBoardEvent, scoreCommand } from '../src/features/device/protocol';
import type { ProfileStore } from '../src/features/interests/types';

test('numeric discovery IDs preserve zeroes and reject other formats', () => {
  assert.equal(readUserCode('001234'), '001234');
  for (const code of [123456, 'ABC1234', '12345', '1234567', '１２３４５６']) assert.throws(() => readUserCode(code));
});
test('UART reassembles split and batched packets, rejects overflow, and splits the score input', () => {
  const events: unknown[] = [];
  const decoder = createLineDecoder(line => events.push(parseBoardEvent(line)));
  const event = { v: 1, type: 'found', event_id: 'board:1', user_code: '001234', source: 'infrared' };
  const wire = JSON.stringify(event) + '\n';
  for (let offset = 0; offset < wire.length; offset += 7) decoder.push(wire.slice(offset, offset + 7));
  decoder.push(wire + wire); assert.equal(events.length, 3); assert.deepEqual(events[0], event);
  assert.throws(() => decoder.push('x'.repeat(4097)));
  assert.deepEqual(scoreCommand('board:1', 72.5, null).percentages, [72.5, null]);
});
test('interest scoring distinguishes missing data, deduplicates, and makes one-to-one matches', () => {
  assert.equal(calculateInterestMatch([], exactTextInterests(['gaming'])).score, null);
  assert.equal(calculateInterestMatch(exactTextInterests(['gaming', 'gaming']), exactTextInterests(['gaming'])).score, 100);
  assert.equal(calculateInterestMatch(exactTextInterests(['gaming']), exactTextInterests(['pottery'])).score, 0);
  const a = [{ label: 'A', standard_id: 'a', category: 'sports', subcategory: 'board' }];
  const b = [{ label: 'B', standard_id: 'b', category: 'art', subcategory: 'board' }];
  assert.equal(calculateInterestMatch(a, b).score, 0);
});
const store: ProfileStore = {
  getMyUserCode: async () => '000001', getMyProfile: async () => ({ user_code: '000001', interests: exactTextInterests(['gaming']) }),
  findByCode: async code => ({ user_code: code, interests: exactTextInterests(['gaming']) }), saveMyInterests: async () => {},
};
test('self-search, manual override, cooldown, and reset follow the required discovery behavior', async () => {
  let now = 0;
  const handler = createDiscoveryHandler(store, async () => 10, () => now);
  const settings = { self_search: false, mode: 'both' as const, minimum_score: 100 };
  assert.equal(await handler.handle({ user_code: '000002', source: 'bluetooth' }, settings), null);
  assert.equal((await handler.handle({ user_code: '000002', source: 'infrared' }, settings))?.should_notify, true);
  settings.self_search = true;
  assert.equal((await handler.handle({ user_code: '000002', source: 'bluetooth' }, settings))?.should_notify, true);
  assert.equal((await handler.handle({ user_code: '000002', source: 'bluetooth' }, settings))?.should_notify, false);
  now = 60000;
  assert.equal((await handler.handle({ user_code: '000002', source: 'bluetooth' }, settings))?.should_notify, true);
  handler.reset();
  assert.equal((await handler.handle({ user_code: '000002', source: 'bluetooth' }, settings))?.should_notify, true);
  assert.equal(await handler.handle({ user_code: '000001', source: 'infrared' }, settings), null);
});
test('skills-only avoids interest lookup and interest errors leave a skill score available', async () => {
  let reads = 0;
  const failing = { ...store, getMyProfile: async () => { reads++; throw new Error('Interest database unavailable'); } };
  const handler = createDiscoveryHandler(failing, async () => 75);
  const found = { user_code: '000002', source: 'bluetooth' as const };
  const skill = await handler.handle(found, { self_search: true, mode: 'skills', minimum_score: 70 });
  assert.equal(reads, 0); assert.equal(skill?.skill_score, 75);
  const both = await handler.handle(found, { self_search: true, mode: 'both', minimum_score: 70 });
  assert.equal(both?.interest_score, null); assert.equal(both?.skill_score, 75); assert.equal(both?.should_notify, true);
});
test('reset discards an in-flight result from the previous profile', async () => {
  let resume!: () => void;
  const delayed = { ...store, findByCode: async (code: string) => { await new Promise<void>(resolve => { resume = resolve; }); return store.findByCode(code); } };
  const handler = createDiscoveryHandler(delayed);
  const promise = handler.handle({ user_code: '000002', source: 'infrared' }, { self_search: false, mode: 'interests', minimum_score: 0 });
  await new Promise<void>(resolve => setImmediate(resolve)); handler.reset(); resume(); assert.equal(await promise, null);
});
test('all TypeScript skill modes agree with the existing Python implementation across varied profiles', () => {
  let seed = 42;
  const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed; };
  const names = ['JS', 'JavaScript', 'React.js', 'python', 'Docker', '  SQL ', 'AI', 'design'];
  const list = () => Array.from({ length: next() % 7 }, () => names[next() % names.length]);
  const pairs: [Skills, Skills][] = Array.from({ length: 80 }, () => [{ have: list(), want: list(), need: list() }, { have: list(), want: list(), need: list() }]);
  const script = `import sys,json;sys.path.insert(0,'../backend');from app.scoring.skills_matcher import calculate_skill_exchange as e,calculate_collaboration_match as c,calculate_learning_partner_match as l;pairs=json.load(sys.stdin);print(json.dumps([[e(a['have'],a['want'],b['have'],b['want']),c(a['have'],a['need'],b['have'],b['need']),l(a['want'],b['want'])] for a,b in pairs]))`;
  const result = spawnSync('python', ['-B', '-c', script], { input: JSON.stringify(pairs), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const expected = JSON.parse(result.stdout);
  for (let index = 0; index < pairs.length; index++) for (const [modeIndex, mode] of (['exchange', 'collaboration', 'learning'] as const).entries()) {
    const actual = calculateSkillMatch(...pairs[index], mode), reference = expected[index][modeIndex];
    assert.equal(actual.score, reference.score); assert.equal(actual.match_type, reference.match_type); assert.equal(actual.is_mutual, reference.is_mutual);
  }
});
