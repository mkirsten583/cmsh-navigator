/* CMSH document parser — shared by the build script (Node) and the browser tool.
   Turns PDF text lines into metadata, sections and cross-references. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CMParser = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const MON_RE = '(January|February|March|April|May|June|July|August|September|October|November|December)';

  /* ---------- PDF -> lines (browser, pdf.js document) ---------- */
  async function linesFromPdf(doc) {
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      pages.push(itemsToLines(tc.items));
    }
    return pages;
  }
  function itemsToLines(items) {
    const rows = [];
    for (const it of items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      const h = Math.round(Math.abs(it.transform[3]) * 10) / 10;
      let row = rows.find(r => Math.abs(r.y - y) <= 2);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, s: it.str, h, w: it.width });
    }
    rows.sort((a, b) => b.y - a.y);
    return rows.map(r => {
      r.items.sort((a, b) => a.x - b.x);
      let txt = '', lastEnd = null;
      for (const it of r.items) {
        if (lastEnd !== null && it.x - lastEnd > 1.5 && !txt.endsWith(' ') && !it.s.startsWith(' ')) txt += ' ';
        txt += it.s; lastEnd = it.x + (it.w || 0);
      }
      return { t: txt.replace(/\s+/g, ' ').trim(), h: Math.max(...r.items.map(i => i.h)), x: Math.round(r.items[0].x) };
    }).filter(l => l.t);
  }

  /* ---------- identification ---------- */
  function identify(pages, filename) {
    const first = pages.slice(0, 3).flat().map(l => l.t).join('\n');
    const fn = (filename || '').toLowerCase();
    let type = 'other', code = '', num = null;
    let m;
    if (/coal mining safety and health act 1999/i.test(pages[0]?.map(l => l.t).join(' ') || '') && !/regulation/i.test((pages[0] || []).slice(0, 6).map(l => l.t).join(' ')) && /act/i.test(fn + first) && !/recognised standard|guidance note/i.test(first.slice(0, 400))) {
      type = 'act'; code = 'CMSHA';
    }
    if (/coal mining safety and health regulation 2017/i.test((pages[0] || []).map(l => l.t).join(' ')) && !/recognised standard|guidance note/i.test(first.slice(0, 400))) {
      type = 'reg'; code = 'CMSHR';
    }
    if (type === 'other') {
      if ((m = fn.match(/recognised-standard-?0?(\d{1,2})/)) || (m = first.match(/Recognised Standard\s+0?(\d{1,2})\b/i))) { type = 'rs'; num = +m[1]; code = 'RS' + num; }
      else if ((m = fn.match(/(?:qgn|guidance-note)-?0?(\d{1,2})/)) || (m = first.match(/\bQGN\s?0?(\d{1,2})\b/))) { type = 'qgn'; num = +m[1]; code = 'QGN' + num; }
      else if (/guideline|hatch/i.test(fn + first)) { type = 'guideline'; code = 'GL-' + (fn.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'doc'); }
    }
    if (fn.includes('vcd-hatch')) { type = 'guideline'; code = 'GL-VCD'; }
    return { type, code, num, title: guessTitle(pages, type) };
  }
  function guessTitle(pages, type) {
    if (type === 'act') return 'Coal Mining Safety and Health Act 1999';
    if (type === 'reg') return 'Coal Mining Safety and Health Regulation 2017';
    const p = pages[0] || [];
    const skip = /^(resources safety|recognised standard|guidance note|queensland guidance note|qgn|coal mining safety and health act|version|date|revision|department|project manager|contents|\d)/i;
    const cands = p.filter(l => l.t.length > 8 && l.t.length < 160 && !skip.test(l.t) && !new RegExp('^' + MON_RE, 'i').test(l.t) && !/state of queensland|gazetted/i.test(l.t));
    if (!cands.length) return '';
    const maxH = Math.max(...cands.map(l => l.h));
    const big = cands.filter(l => l.h >= maxH - 0.5);
    // join consecutive title lines of the biggest font
    return big.map(l => l.t).join(' ').replace(/\s+/g, ' ').replace(/^(Queensland Guidance Note|Guidance Note)\s*\d*\s*/i, '').trim();
  }

  /* ---------- dates & versions ---------- */
  function toISO(d, mon, y) {
    const mi = MONTHS.indexOf(mon.toLowerCase());
    if (mi < 0) return null;
    return y + '-' + String(mi + 1).padStart(2, '0') + '-' + String(d || 1).padStart(2, '0');
  }
  function findDate(s) {
    let m = s.match(new RegExp('(\\d{1,2})\\s*' + MON_RE + '\\s+(\\d{4})', 'i'));
    if (m) return { iso: toISO(+m[1], m[2], m[3]), exact: true };
    m = s.match(new RegExp(MON_RE + '\\s+(\\d{4})', 'i'));
    if (m) return { iso: toISO(1, m[1], m[2]), exact: false };
    return null;
  }
  function dates(pages, type) {
    const out = { issued: null, issuedExact: false, gazetted: null, version: null, copyright: null, currentAsAt: null };
    const early = pages.slice(0, 6).flat().map(l => l.t);
    for (const t of early) {
      let m;
      if (!out.gazetted && (m = t.match(/(Gazetted|Notified)\s*([^\]]+)/i))) { const d = findDate(m[2]); if (d) out.gazetted = d.iso; }
      if (!out.currentAsAt && (m = t.match(/Current as at\s+(.+)/i))) { const d = findDate(m[1]); if (d) out.currentAsAt = d.iso; }
      if (!out.version && (m = t.match(/\b(?:Version|Revision)\s*(?:no\.?|:)?\s*(\d+(?:\.\d+)?)/i)) && !/latest version|web version/i.test(t)) out.version = m[1];
      if (!out.copyright && (m = t.match(/©.*?(\d{4})/))) out.copyright = +m[1];
    }
    // issue date: first dated line on the cover, else a version table line
    const cover = (pages[0] || []).map(l => l.t);
    for (const t of cover) {
      if (/gazetted|notified|died|inquest|coroner/i.test(t)) continue;
      const d = findDate(t);
      if (d && t.length < 60) { out.issued = d.iso; out.issuedExact = d.exact; break; }
    }
    if (!out.issued) {
      for (const t of early) {
        if (/^(\d+(\.\d+)?)\s+(\d{1,2}\s+)?[A-Z][a-z]+\s+\d{4}$/.test(t) || /^Version:?\s*\d/i.test(t)) {
          const d = findDate(t); if (d) { out.issued = d.iso; out.issuedExact = d.exact; break; }
        }
      }
    }
    if (out.currentAsAt) { out.issued = out.currentAsAt; out.issuedExact = true; }
    // the date the tool treats as "this version's date"
    if (out.issued) out.basis = 'issue date';
    if (out.gazetted && (!out.issued || out.gazetted > out.issued)) { out.issued = out.gazetted; out.issuedExact = true; out.basis = 'gazettal date'; }
    if (!out.issued && out.copyright) { out.issued = out.copyright + '-01-01'; out.issuedExact = false; out.basis = 'copyright year'; }
    if (out.currentAsAt) out.basis = 'current as at';
    return out;
  }

  /* ---------- cleaning ---------- */
  const norm = t => t.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();
  function repeatedLines(pages) {
    const count = new Map();
    pages.forEach(p => { const seen = new Set(); p.forEach(l => { const k = norm(l.t); if (!seen.has(k)) { seen.add(k); count.set(k, (count.get(k) || 0) + 1); } }); });
    const lim = Math.max(3, Math.ceil(pages.length * 0.3));
    return new Set([...count].filter(([k, c]) => c >= lim && k.length < 160).map(([k]) => k));
  }
  function isTocPage(lines) {
    if (!lines.length) return false;
    const tocish = lines.filter(l => /(\.{4,}|(\.\s){3,}|…{2,}|\s\d{1,3}$|\s[ivx]{1,4}$)/.test(l.t) && l.t.length < 160).length;
    const hasWord = lines.some(l => /^(contents|table of contents)$/i.test(l.t));
    return tocish / lines.length > 0.45 || (hasWord && tocish / lines.length > 0.25);
  }
  function bodySize(pages) {
    const w = new Map();
    pages.flat().forEach(l => { if (l.h > 0) w.set(l.h, (w.get(l.h) || 0) + l.t.length); });
    let best = 10, bw = -1;
    for (const [h, c] of w) if (c > bw) { bw = c; best = h; }
    return best;
  }

  const BOILER = /(71\s+Purpose of recognised standards|Purpose of recognised standards|Interpreter statement|Creative Commons|shall not be liable|©\s*(The )?State of Queensland|This publication has been compiled|may be updated from time to time|issued under the authority of the Minister)/i;

  /* ---------- sectioning ---------- */
  const NUM_HEAD = /^((?:\d{1,2})(?:\.\d{1,2}){0,3})\.?\s+([A-Z][^]{1,140})$/;
  const LEG_HEAD = /^(\d{1,3}[A-Z]{0,3})\s+([A-Z][A-Za-z0-9 ,’'()\-—–\/&:]{2,150})$/;
  const PART_HEAD = /^(Chapter|Part|Division|Subdivision|Schedule)\s+(\d+[A-Z]{0,2})\b\s*(.*)$/;

  function sectionise(pages, info) {
    let s = sectioniseOnce(pages, info, {});
    if (info.type !== 'act' && info.type !== 'reg' && s.filter(x => x.num).length < 4) {
      const r = sectioniseOnce(pages, info, { relaxed: true });
      if (r.filter(x => x.num).length > s.filter(x => x.num).length) s = r;
    }
    return s;
  }
  function sectioniseOnce(pages, info, opts) {
    const legal = info.type === 'act' || info.type === 'reg';
    const rep = repeatedLines(pages);
    const body = bodySize(pages);
    const bigCount = new Map();
    pages.flat().forEach(l => { if (l.h >= body * 1.12) { const k = norm(l.t); bigCount.set(k, (bigCount.get(k) || 0) + 1); } });
    const sections = [];
    let cur = null, crumbs = {};
    const start = (num, heading, page, extra) => {
      cur = Object.assign({ num, heading: heading.trim(), page, lines: [] }, extra || {});
      sections.push(cur);
    };
    start('', 'Front matter', 1, { front: true });
    pages.forEach((lines, pi) => {
      if (isTocPage(lines)) return;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const t = l.t;
        if (legal && (m0 = t.match(PART_HEAD)) && t.length < 150 && !/[.;]$/.test(t)) {
          const lvl = m0[1].toLowerCase();
          if (lvl === 'chapter' && crumbs.chapter !== t) crumbs = { chapter: t };
          else if (lvl === 'part' && crumbs.part !== t) crumbs = { chapter: crumbs.chapter, part: t };
          else if (lvl === 'division' && crumbs.division !== t) crumbs = { chapter: crumbs.chapter, part: crumbs.part, division: t };
          else if (lvl === 'subdivision') crumbs = Object.assign({}, crumbs, { subdivision: t });
          else if (lvl === 'schedule' && crumbs.schedule !== t && !rep.has(norm(t))) { crumbs = { schedule: t }; start('sch' + m0[2], t, pi + 1, { crumbs: Object.assign({}, crumbs) }); }
          continue;
        }
        if (rep.has(norm(t))) continue;
        if (/^(page\s*)?\d{1,3}(\s*of\s*\d{1,3})?$/i.test(t) || /^[ivxl]{1,5}$/i.test(t)) continue;
        if (legal && /^\[s\s*\d+[A-Z]*\]$/.test(t)) continue;
        if (legal && /^(Page \d+|Current as at|Authorised by the Parliamentary Counsel)/i.test(t)) continue;
        const big = l.h >= body * 1.12;
        if (big && !legal && (bigCount.get(norm(t)) >= 3 || !/[A-Za-z]{3,}/.test(t))) continue;
        let m;
        if (legal) {
          if ((m = t.match(LEG_HEAD)) && !/[.;,]$/.test(t) && (big || l.h >= body) && !/^\d+\s+(or|and|of|to|per|days?|months?|years?|hours?|minutes?|persons?|metres?|m|mm|km|kg|%)\b/i.test(t)) {
            start(m[1], m[2], pi + 1, { crumbs: Object.assign({}, crumbs) });
            continue;
          }
        } else if (!big && (m = t.match(NUM_HEAD)) && t.length < 90 && !/[.,;:]$/.test(t) && +m[1].split('.')[0] <= 40 &&
                   (/^[A-Z0-9 ,&\/()\-–'’]{3,}$/.test(m[2]) || (opts.relaxed && m[2].split(' ').length <= 9 && !/^\d+\s/.test(t.slice(m[1].length + 1))))) {
          start(m[1].replace(/\.0$/, ''), m[2].charAt(0) + m[2].slice(1).toLowerCase().replace(/\b(shms|phmp|sop|cmsha|cmshr|sse|erz|rs|qgn|as|nzs|co|co2|ch4)\b/g, x => x.toUpperCase()), pi + 1);
          continue;
        } else if (big && t.length <= 150 && !/[.,;:]$/.test(t) && !/^(•|-|–|\(|table|figure)/i.test(t)) {
          // heading, maybe wrapping onto the next line(s) with the same size
          let head = t;
          while (i + 1 < lines.length && Math.abs(lines[i + 1].h - l.h) < 0.3 && lines[i + 1].t.length < 120 && !NUM_HEAD.test(lines[i + 1].t) && head.length < 160) { head += ' ' + lines[++i].t; }
          if ((m = head.match(NUM_HEAD))) start(m[1].replace(/\.0$/, ''), m[2], pi + 1);
          else if (/^(appendix|attachment|schedule|annex)/i.test(head)) start(head.match(/^\w+\s*[\dA-Z]*/)[0], head, pi + 1);
          else if (l.h >= body * 1.3 || cur.lines.length > 2) start('', head, pi + 1);
          else cur.lines.push(head);
          continue;
        }
        cur.lines.push(t);
      }
    });
    // build text, drop empty, mark boilerplate
    const out = [];
    for (const s of sections) {
      const text = joinLines(s.lines);
      if (!text && !s.front) continue;
      if (!text) continue;
      const boiler = !!s.front || BOILER.test(text) && text.length < 4000;
      out.push({ num: s.num, heading: s.heading, page: s.page, text, crumbs: s.crumbs, boiler });
    }
    // merge tiny headless fragments into previous section
    const merged = [];
    for (const s of out) {
      const prev = merged[merged.length - 1];
      if (prev && !s.num && s.text.length < 60 && !legal) { prev.text += '\n' + s.heading + '\n' + s.text; continue; }
      merged.push(s);
    }
    return merged;
  }
  function joinLines(lines) {
    const paras = [];
    let cur = '';
    for (const raw of lines) {
      const t = raw.trim(); if (!t) continue;
      const newPara = /^(•|▪|–|-\s|\(\w{1,4}\)|\d{1,2}[.)]\s|[a-z][.)]\s|Note|Table \d|Figure \d)/.test(t);
      if (!cur) { cur = t; continue; }
      if (newPara || /[.:;]$/.test(cur) && /^[A-Z]/.test(t)) { paras.push(cur); cur = t; }
      else if (/-$/.test(cur) && /^[a-z]/.test(t)) cur = cur.slice(0, -1) + t;
      else cur += ' ' + t;
    }
    if (cur) paras.push(cur);
    return paras.join('\n');
  }

  /* ---------- cross-references ---------- */
  const NUMLIST = '(\\d{1,3}[A-Z]{0,3}(?:\\s?\\([0-9a-z]{1,4}\\))*(?:\\s*(?:,|and|&|or|to|–|-)\\s*\\d{1,3}[A-Z]{0,3}(?:\\s?\\([0-9a-z]{1,4}\\))*)*)';
  const SEC_RE = new RegExp('\\b(?:sections?|ss?\\.?|sec\\.?)\\s*' + NUMLIST, 'gi');
  const INSTR_AFTER = /^[\s,]*(?:of\s+(?:the\s+)?|under\s+(?:the\s+)?|in\s+(?:the\s+)?)?(?:\(?(Coal Mining Safety and Health|CMSH|Mining and Quarrying Safety and Health|MQSH)\s*(Act|Regulations?|A|R)?\s*(1999|2001|2017)?\)?|(CMSHA|CMSHR|MQSHA|MQSHR)(?:\s*(1999|2001|2017))?|the\s+(Act|Regulations?)\b|(Act|Regulation)\b)/i;
  const INSTR_BEFORE = /(CMSHA|CMSHR|CMSH Act|CMSH Regulation|Coal Mining Safety and Health (?:Act|Regulation)(?: 1999| 2017| 2001)?)\s*,?\s*$/i;

  function instrumentFrom(m) {
    if (!m) return null;
    const s = m[0];
    if (/Mining and Quarrying|MQSH/i.test(s)) return 'skip';
    if (/2001/.test(s)) return 'reg2001';
    if (/Regulation|CMSHR|\bR\b/i.test(s)) return 'reg';
    if (/Act|CMSHA|\bA\b/i.test(s)) return 'act';
    return null;
  }
  function expandNums(list) {
    const nums = [];
    const parts = list.split(/\s*(,|and|&|or|to|–|-)\s*/);
    let prev = null, range = false;
    for (const p of parts) {
      if (/^(to|–|-)$/.test(p)) { range = true; continue; }
      if (/^(,|and|&|or)$/.test(p)) { range = false; continue; }
      const base = (p.match(/^\d{1,3}[A-Z]{0,3}/) || [])[0];
      if (!base) continue;
      if (range && prev && /^\d+$/.test(prev) && /^\d+$/.test(base) && +base > +prev && +base - +prev <= 12) {
        for (let k = +prev + 1; k <= +base; k++) nums.push(String(k));
      } else nums.push(base);
      prev = base; range = false;
    }
    return nums;
  }
  // Find every reference in a text, with its character span (used for links in the reader)
  function refSpans(text, info) {
    const spans = [];
    const selfLegal = info && (info.type === 'act' || info.type === 'reg') ? info.type : null;
    let m;
    const re = new RegExp(SEC_RE.source, 'gi');
    while ((m = re.exec(text))) {
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 90);
      const before = text.slice(Math.max(0, m.index - 60), m.index);
      const am = after.match(INSTR_AFTER);
      let inst = instrumentFrom(am), end = m.index + m[0].length;
      if (inst && am) end += am[0].length;
      if (!inst) inst = instrumentFrom(before.match(INSTR_BEFORE));
      if (!inst && selfLegal) inst = selfLegal;
      if (inst === 'skip') continue;
      if (!inst) {
        // same-document reference such as "section 4.13" in a standard
        const own = (m[1].match(/^\d{1,2}(?:\.\d{1,2}){0,3}/) || [])[0];
        if (own && info && info.code) spans.push({ start: m.index, end: m.index + m[0].length, keys: [info.code + ':' + own], internal: true });
        continue;
      }
      spans.push({ start: m.index, end, keys: expandNums(m[1]).map(n => inst + ':' + n) });
    }
    const simple = (re2, mk) => { let x; while ((x = re2.exec(text))) { const k = mk(x); if (k) spans.push({ start: x.index, end: x.index + x[0].length, keys: [k] }); } };
    simple(/\b(?:RS|Recognised Standard)\s?0?(\d{1,2})\b/g, x => { const n = +x[1]; return n >= 1 && n <= 40 && !(info && info.type === 'rs' && info.num === n) ? 'rs:' + n : null; });
    simple(/\b(?:QGN|Guidance Note(?: QGN)?)\s?0?(\d{1,2})\b/g, x => { const n = +x[1]; return n >= 1 && n <= 60 && !(info && info.type === 'qgn' && info.num === n) ? 'qgn:' + n : null; });
    simple(/\b(AS\/NZS ISO|AS\/NZS|AS|ISO)\s?(\d{3,5}(?:\.\d{1,2}){0,2})(?:\s?[:\-–]\s?(\d{4}))?/g, x => (/^(19|20)\d\d$/.test(x[2]) && !x[3] && x[1] === 'AS') ? null : 'std:' + x[1].replace('AS/NZS ISO', 'AS/NZS') + ' ' + x[2]);
    spans.sort((a, b) => a.start - b.start);
    const out = []; let last = -1;
    for (const sp of spans) if (sp.start >= last) { out.push(sp); last = sp.end; }
    return out;
  }
  function extractRefs(text, info) {
    const keys = new Set();
    refSpans(text, info).forEach(sp => { if (!sp.internal) sp.keys.forEach(k => keys.add(k)); });
    return [...keys];
  }

  /* ---------- whole document ---------- */
  function buildDoc(pages, filename, overrides) {
    const info = Object.assign(identify(pages, filename), overrides || {});
    const d = dates(pages, info.type);
    const sections = sectionise(pages, info);
    const legal = info.type === 'act' || info.type === 'reg';
    const prefix = legal ? info.type : info.code;
    const used = new Set();
    let cites2001 = false;
    sections.forEach((s, i) => {
      let sid = prefix + ':' + (s.num || 'p' + s.page + '-' + i);
      if (used.has(sid)) sid += '~' + i;
      used.add(sid); s.sid = sid;
      s.refs = s.boiler ? [] : extractRefs(s.heading + '\n' + s.text, info);
      if (!s.boiler && /Regulation\s*2001/.test(s.text)) cites2001 = true;
    });
    return {
      id: info.code, code: info.code, type: info.type, num: info.num, title: info.title,
      issued: d.issued, issuedExact: d.issuedExact, dateBasis: d.basis || null, gazetted: d.gazetted, version: d.version, copyright: d.copyright,
      cites2001, pageCount: pages.length, filename: filename || '', sections
    };
  }

  return { linesFromPdf, itemsToLines, buildDoc, extractRefs, refSpans, identify, dates, findDate };
});
