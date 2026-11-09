#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const window = {};
const ctx = vm.createContext({ window, console });
for (const f of ['exam-fiches.js', 'exam-subjects.js', 'exam-subjects-2.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'js', f), 'utf8'), ctx, { filename: f });
}
const S = window.AideVisio;
let ok = 0; const fails = [];
const check = (cond, msg) => { if (cond) ok++; else fails.push(msg); };
const isStr = (x) => typeof x === 'string' && x.trim().length > 0;
const words = (t) => String(t).split(/\s+/).filter(Boolean).length;
const pairs = (a) => Array.isArray(a) && a.every((x) => x && isStr(x.en) && isStr(x.fr));

const subs = S.examSubjects;
check(Array.isArray(subs) && subs.length === 12, `12 sujets attendus (${subs && subs.length})`);
const ids = new Set();
const THEMES = ['Finance', 'Accounting & auditing', 'Governance & CSR', 'Information systems & new technologies', 'Management, HR & strategy', 'Production', 'Marketing'];
for (const s of subs || []) {
  const p = `[${s.id}]`;
  check(/^[a-z0-9-]+$/.test(s.id) && !ids.has(s.id), `${p} id kebab unique`); ids.add(s.id);
  check(Number.isInteger(s.theme) && s.theme >= 1 && s.theme <= 7, `${p} theme 1..7`);
  check(isStr(s.themeTitle), `${p} themeTitle`);
  check(THEMES[s.theme - 1] === s.themeTitle, `${p} themeTitle « ${s.themeTitle} » ≠ « ${THEMES[s.theme - 1]} »`);
  for (const k of ['title', 'source', 'date', 'question']) check(isStr(s[k]), `${p} ${k}`);
  check(/^Practice text/.test(s.source), `${p} source « Practice text … »`);
  check(/^[A-Z][a-z]+ \d{4}$/.test(s.date), `${p} date « Month YYYY » (${s.date})`);
  check(/\?$/.test(s.question.trim()) || /\.$/.test(s.question.trim()), `${p} question ponctuée`);
  check(Array.isArray(s.paragraphs) && s.paragraphs.length >= 5 && s.paragraphs.length <= 7 && s.paragraphs.every(isStr), `${p} 5-7 paragraphes`);
  const w = words((s.paragraphs || []).join(' '));
  check(w >= 370 && w <= 490, `${p} 380-480 mots (${w})`);
  check(Array.isArray(s.glossary) && s.glossary.length >= 3 && s.glossary.length <= 6 && pairs(s.glossary), `${p} glossaire 3-6`);
  const c = s.corrige || {};
  for (const k of ['topic', 'tone', 'problematic']) check(isStr(c[k]), `${p} corrige.${k}`);
  check(Array.isArray(c.summary) && c.summary.length >= 4 && c.summary.length <= 6 && c.summary.every(isStr), `${p} summary 4-6`);
  check(Array.isArray(c.plan) && c.plan.length >= 2 && c.plan.length <= 3 && c.plan.every((x) => isStr(x.title) && Array.isArray(x.points) && x.points.length && x.points.every(isStr)), `${p} plan 2-3 axes`);
  check(Array.isArray(c.news) && c.news.length >= 1 && c.news.every(isStr), `${p} news`);
  check(Array.isArray(c.juryQuestions) && c.juryQuestions.length >= 8 && c.juryQuestions.length <= 10 && pairs(c.juryQuestions), `${p} juryQuestions 8-10`);
  check(Array.isArray(c.keyVocab) && c.keyVocab.length >= 8 && c.keyVocab.length <= 12 && c.keyVocab.every((x) => isStr(x) && / — /.test(x)), `${p} keyVocab 8-12 « word — mot »`);
  const all = JSON.stringify(s);
  check(!/\b\d{7,}\b/.test(all), `${p} pas de numéro type n° étudiant`);
}
check(new Set((subs || []).map((s) => s.theme)).size === 7, 'les 7 thèmes couverts');

const F = S.examFiches || {};
check(F.exam && isStr(F.exam.date) && isStr(F.exam.title) && isStr(F.exam.mode) && Array.isArray(F.exam.format) && F.exam.format.every((x) => isStr(x.label) && typeof x.minutes === 'number'), 'fiches.exam');
check(F.exam && F.exam.date === '2026-11-12T10:00', 'date de l’oral');
check(Array.isArray(F.method) && F.method.length >= 8 && F.method.every((m) => isStr(m.id) && isStr(m.title) && (m.minutes === null || typeof m.minutes === 'number') && isStr(m.goal) && Array.isArray(m.tips) && Array.isArray(m.phrases)), 'fiches.method');
check(Array.isArray(F.phrases) && F.phrases.length >= 10 && F.phrases.every((b) => isStr(b.id) && isStr(b.title) && pairs(b.items) && b.items.length), 'fiches.phrases');
check(pairs(F.tones) && F.tones.length >= 10, 'fiches.tones');
check(Array.isArray(F.linking) && F.linking.every((g) => isStr(g.group) && pairs(g.items)), 'fiches.linking');
check(Array.isArray(F.themes) && F.themes.length === 7 && F.themes.every((t, i) => t.id === i + 1 && isStr(t.title) && isStr(t.fr) && pairs(t.vocab) && t.vocab.length >= 20 && t.vocab.length <= 30 && Array.isArray(t.facts) && Array.isArray(t.debates)), 'fiches.themes');
check(Array.isArray(F.news) && F.news.length >= 6 && F.news.every((n) => isStr(n.title) && isStr(n.date) && isStr(n.summary) && isStr(n.en) && Array.isArray(n.themes) && n.themes.every((x) => x >= 1 && x <= 7)), 'fiches.news');
check(Array.isArray(F.errors) && F.errors.length >= 12 && F.errors.every((e) => isStr(e.title) && isStr(e.wrong) && isStr(e.right) && isStr(e.tip)), 'fiches.errors');
check(Array.isArray(F.pronunciation) && F.pronunciation.length >= 25 && F.pronunciation.length <= 35 && F.pronunciation.every((p) => isStr(p.word) && isStr(p.ipa) && isStr(p.tip)), 'fiches.pronunciation');
check(Array.isArray(F.checklist) && F.checklist.map((c) => c.when).join('|') === 'La veille|Le matin|Pendant l\'oral' && F.checklist.every((c) => Array.isArray(c.items) && c.items.every(isStr)), 'fiches.checklist');

if (fails.length) { console.log(`Contenus de l'oral : ${ok} réussis, ${fails.length} échoués`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`Contenus de l'oral : ${ok} réussis, 0 échoués`);
