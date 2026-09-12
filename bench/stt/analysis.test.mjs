import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

createRequire(import.meta.url)('./analysis.js');
const B = globalThis.SttBench;

const mark = (t, text, engines = ['ws', 'aai'], silence = 0, idx = 0) => ({ t, text, engines, silence, pass: 1, idx });

test('parseScript reads silence markers and skips blank lines', () => {
  const lines = B.parseScript('First line\n\n[silence 30] After the pause\n');
  assert.deepEqual(lines, [
    { silence: 0, text: 'First line' },
    { silence: 30, text: 'After the pause' },
  ]);
  assert.equal(B.parseScript(B.DEFAULT_SCRIPT).filter((l) => l.silence).length, 1);
});

test('missingWords ignores case, punctuation, apostrophes, and counts repeats', () => {
  assert.deepEqual(B.missingWords("No, that one's Priya's.", 'no that ones priyas'), []);
  assert.deepEqual(B.missingWords('by Friday by Friday', 'By Friday.'), ['by', 'friday']);
});

test('lag runs from the mark to the last final for that line, including finals that land during the next line', () => {
  const state = {
    marks: [mark(1000, 'Sam, can you own the vendor follow-up by Friday?'), mark(5000, 'No, that one is Priya')],
    finals: {
      ws: [
        { t: 900, text: 'Sam can you own the' },
        { t: 1600, text: 'vendor follow-up by Friday' },
        { t: 5700, text: 'no that one is Priya' },
      ],
      aai: [],
    },
    events: [],
  };
  const { rows, sum } = B.analyze(state, 'ws', 'Next scripted line');
  assert.equal(rows[0].lag, 600);
  assert.equal(rows[1].lag, 700);
  assert.equal(sum.median, 650);
  assert.equal(sum.dropped, 0);
  assert.equal(sum.noFinal, 0);

  const aai = B.analyze(state, 'aai', '').sum;
  assert.equal(aai.noFinal, 2);
  assert.equal(aai.median, null);
});

test('an unrelated final right after a mark stays with the marked line, a later one goes to the line being spoken', () => {
  const state = {
    marks: [mark(1000, 'alpha beta'), mark(9000, 'gamma delta')],
    finals: { ws: [{ t: 1500, text: 'um' }, { t: 6000, text: 'hmm' }], aai: [] },
    events: [],
  };
  const { rows } = B.analyze(state, 'ws', '');
  assert.equal(rows[0].heard, 'um');
  assert.equal(rows[1].heard, 'hmm');
});

test('lines where an engine was not running are excluded from its summary', () => {
  const state = {
    marks: [mark(1000, 'hello world', ['ws']), mark(20000, 'second line', ['aai'], 30)],
    finals: { ws: [{ t: 1200, text: 'hello world' }], aai: [{ t: 20400, text: 'second' }] },
    events: [
      { engine: 'ws', kind: 'restart', gap: 250 },
      { engine: 'ws', kind: 'restart', gap: 410 },
      { engine: 'ws', kind: 'error', error: 'no-speech' },
    ],
  };
  const ws = B.analyze(state, 'ws', '');
  assert.equal(ws.rows[1].active, false);
  assert.equal(ws.sum.lines, 1);
  assert.equal(ws.sum.restarts, 2);
  assert.equal(ws.sum.maxGap, 410);
  assert.deepEqual(ws.sum.errors, { 'no-speech': 1 });

  const aai = B.analyze(state, 'aai', '');
  assert.equal(aai.sum.lines, 1);
  assert.equal(aai.rows[1].heard, 'second');
  assert.deepEqual(aai.sum.silence, [{ missing: 1, words: 2, lag: 400 }]);
});

test('toMarkdown names both engines, reports the medians, and leaves the pick to the tester', () => {
  const state = {
    marks: [mark(1000, 'alpha beta'), mark(4000, 'gamma | delta', ['ws', 'aai'], 0, 1)],
    finals: {
      ws: [{ t: 1800, text: 'alpha beta' }, { t: 4900, text: 'gamma delta' }],
      aai: [{ t: 1400, text: 'alpha' }],
    },
    events: [],
    activeMs: { ws: 125000, aai: 125000 },
  };
  const md = B.toMarkdown(state, '');
  assert.match(md, /\| Measure \| Web Speech API \| AssemblyAI streaming \|/);
  assert.match(md, /\| Median lag, line done to final text \| 850 ms \| 400 ms \|/);
  assert.match(md, /\| Dropped words \| 0 of 4 \(0\.0%\) \| 3 of 4 \(75\.0%\) \|/);
  assert.match(md, /together on the same speech/);
  assert.match(md, /\*\*Pick:\*\* _fill in_/);
  assert.match(md, /gamma \\\| delta/);
  assert.equal(B.toMarkdown({ marks: [] }, ''), 'No lines marked yet.');
});
