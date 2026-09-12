// Pure scoring logic for the speech-to-text bench. Loaded by index.html as a
// plain script and by analysis.test.mjs through require().
(function (root) {
  'use strict';

  // Provisional lines drawn from the demo beats in docs/CONCEPT_PLAN.md.
  // Issue #7 owns the frozen script; paste it into the page when it lands.
  const DEFAULT_SCRIPT = [
    "Okay, let's get started. First item is the venue budget, we have ten minutes.",
    'We decided to keep the downtown venue and drop the second option.',
    "We're running long on this one, let's move on.",
    'Next item is the vendor contracts.',
    'Sam, can you own the vendor follow-up by Friday?',
    "Sure, I'll send the vendor follow-up by Friday.",
    'Someone needs to update the budget spreadsheet before the review.',
    "No, that one's Priya's.",
    'The third item is the launch date, but I think we already covered it.',
    "That's a wrap, thanks everyone.",
    '[silence 30] Please send the follow-up to the team channel.',
  ].join('\n');

  const NAMES = { ws: 'Web Speech API', aai: 'AssemblyAI streaming' };
  const ENGINES = ['ws', 'aai'];
  const TIE_WINDOW_MS = 3000;

  function parseScript(text) {
    return String(text || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const m = s.match(/^\[silence\s+(\d+)\]\s*(.*)$/i);
        return m ? { silence: Number(m[1]), text: m[2].trim() } : { silence: 0, text: s };
      })
      .filter((l) => l.text);
  }

  function tokens(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean);
  }

  function overlap(heard, scripted) {
    const set = new Set(tokens(scripted));
    return tokens(heard).filter((t) => set.has(t)).length;
  }

  // Scripted words not present in the heard text, counting repeats.
  function missingWords(scripted, heard) {
    const counts = new Map();
    for (const t of tokens(heard)) counts.set(t, (counts.get(t) || 0) + 1);
    const missing = [];
    for (const t of tokens(scripted)) {
      const n = counts.get(t) || 0;
      if (n > 0) counts.set(t, n - 1);
      else missing.push(t);
    }
    return missing;
  }

  function median(xs) {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  // A final can land after its line was marked done, while the next line is
  // being spoken. Compare it with both lines and keep the better word overlap.
  function assignFinals(marks, finals, inProgressText, engine) {
    const rows = marks.map(() => ({ texts: [], lastT: null }));
    const active = (m) => (m.engines || []).includes(engine);
    for (const f of finals) {
      let c = 0;
      while (c < marks.length && marks[c].t < f.t) c++;
      let target = c;
      if (c > 0 && active(marks[c - 1])) {
        const prev = overlap(f.text, marks[c - 1].text);
        const cur = overlap(f.text, c < marks.length ? marks[c].text : inProgressText || '');
        if (prev > cur || (prev === cur && f.t - marks[c - 1].t < TIE_WINDOW_MS)) target = c - 1;
      }
      if (target < marks.length) {
        rows[target].texts.push(f.text);
        rows[target].lastT = f.t;
      }
    }
    return rows;
  }

  function analyze(state, engine, inProgressText) {
    const marks = state.marks || [];
    const assigned = assignFinals(marks, (state.finals || {})[engine] || [], inProgressText, engine);
    const rows = marks.map((m, k) => {
      const active = (m.engines || []).includes(engine);
      const heard = assigned[k].texts.join(' ');
      return {
        active,
        heard,
        finals: assigned[k].texts.length,
        lag: active && assigned[k].lastT != null ? assigned[k].lastT - m.t : null,
        missing: active ? missingWords(m.text, heard) : [],
      };
    });
    const act = rows.map((r, k) => ({ r, m: marks[k] })).filter((x) => x.r.active);
    const lags = act.map((x) => x.r.lag).filter((v) => v != null);
    const events = (state.events || []).filter((e) => e.engine === engine);
    const gaps = events.filter((e) => e.kind === 'restart' && typeof e.gap === 'number').map((e) => e.gap);
    const errors = {};
    for (const e of events) if (e.error) errors[e.error] = (errors[e.error] || 0) + 1;
    return {
      rows,
      sum: {
        lines: act.length,
        median: median(lags),
        max: lags.length ? Math.max(...lags) : null,
        noFinal: act.filter((x) => x.r.finals === 0).length,
        words: act.reduce((n, x) => n + tokens(x.m.text).length, 0),
        dropped: act.reduce((n, x) => n + x.r.missing.length, 0),
        silence: act
          .filter((x) => x.m.silence > 0)
          .map((x) => ({ missing: x.r.missing.length, words: tokens(x.m.text).length, lag: x.r.lag })),
        restarts: gaps.length,
        maxGap: gaps.length ? Math.max(...gaps) : null,
        errors,
      },
    };
  }

  const fmtMs = (v) => (v == null ? '-' : `${Math.round(v)} ms`);
  const fmtMin = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

  function enginesUsed(state) {
    return ENGINES.filter((e) => (state.marks || []).some((m) => (m.engines || []).includes(e)));
  }

  function toMarkdown(state, inProgressText) {
    const marks = state.marks || [];
    if (!marks.length) return 'No lines marked yet.';
    const used = enginesUsed(state);
    const A = {};
    for (const e of used) A[e] = analyze(state, e, inProgressText);
    const together = marks.some((m) => (m.engines || []).length > 1);
    const passes = new Set(marks.map((m) => m.pass)).size;
    const active = state.activeMs || {};
    const out = [];
    out.push('### Speech-to-text bench results', '');
    out.push(
      `Recorded ${new Date(marks[0].t).toLocaleString()}. ${marks.length} lines marked over ${passes} pass(es). ` +
        `Engines ran ${together ? 'together on the same speech' : 'in separate sessions'}. ` +
        `Listening time: ${used.map((e) => `${NAMES[e]} ${fmtMin(active[e] || 0)}`).join(', ')}.`
    );
    out.push('Room and mic: _fill in_. Network: _venue Wi-Fi or hotspot_.', '');
    out.push(`| Measure | ${used.map((e) => NAMES[e]).join(' | ')} |`);
    out.push(`|---|${used.map(() => '---').join('|')}|`);
    const row = (label, f) => out.push(`| ${label} | ${used.map((e) => cell(f(A[e].sum))).join(' | ')} |`);
    row('Median lag, line done to final text', (s) => fmtMs(s.median));
    row('Max lag', (s) => fmtMs(s.max));
    row('Lines with no final text', (s) => `${s.noFinal} of ${s.lines}`);
    row('Dropped words', (s) =>
      `${s.dropped} of ${s.words}${s.words ? ` (${((s.dropped / s.words) * 100).toFixed(1)}%)` : ''}`
    );
    row('Line after silence: dropped words, lag', (s) =>
      s.silence.length ? s.silence.map((x) => `${x.missing} of ${x.words}, ${fmtMs(x.lag)}`).join('; ') : 'not marked'
    );
    row('Restarts or reconnects', (s) => `${s.restarts}${s.maxGap != null ? `, max gap ${fmtMs(s.maxGap)}` : ''}`);
    row('Errors and warnings', (s) =>
      Object.entries(s.errors).map(([k, v]) => `${k} x${v}`).join(', ') || 'none'
    );
    out.push('');
    out.push(
      'Lag runs from the Space press at the end of each line to the last final text for that line. ' +
        'It includes the same reaction time for both engines, so compare the two numbers rather than reading either as absolute.'
    );
    out.push('', '**Pick:** _fill in_. **Reason:** _fill in_.', '');
    out.push('<details><summary>Per-line detail</summary>', '');
    const short = { ws: 'WS', aai: 'AAI' };
    out.push(`| Pass | # | Scripted | ${used.map((e) => `${short[e]} heard | ${short[e]} lag | ${short[e]} missing`).join(' | ')} |`);
    out.push(`|---|---|---|${used.map(() => '---|---|---').join('|')}|`);
    marks.forEach((m, k) => {
      const cols = used.map((e) => {
        const r = A[e].rows[k];
        if (!r.active) return 'not run | - | -';
        return `${cell(r.heard || '(nothing)')} | ${fmtMs(r.lag)} | ${cell(r.missing.join(' ') || '-')}`;
      });
      out.push(`| ${m.pass} | ${m.idx + 1} | ${cell((m.silence ? `[silence ${m.silence}] ` : '') + m.text)} | ${cols.join(' | ')} |`);
    });
    out.push('', '</details>');
    return out.join('\n');
  }

  root.SttBench = {
    DEFAULT_SCRIPT, NAMES, ENGINES, parseScript, tokens, overlap, missingWords, median,
    assignFinals, analyze, enginesUsed, toMarkdown, fmtMs, fmtMin,
  };
})(globalThis);
