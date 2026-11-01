import { clampDay, daysInMonth, findSongs, parseHash, toMd } from '../lib/nearest';
import { formatFullDate, resultSentence, spokenDate } from '../lib/format';
import type { DB, Match, Result, Song } from '../lib/types';

type SearchDetail = { month: number; day: number };

declare global {
  interface WindowEventMap {
    'mdm:search': CustomEvent<SearchDetail>;
    'mdm:result': CustomEvent<{ md: string }>;
  }
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} missing`);
  return node as T;
}

const db = JSON.parse(el<HTMLScriptElement>('db').textContent ?? '{}') as DB;
const form = el<HTMLFormElement>('date-form');
const daySelect = el<HTMLSelectElement>('day-select');
const monthSelect = el<HTMLSelectElement>('month-select');
const resultBox = el<HTMLDivElement>('result');
const cardTemplate = el<HTMLTemplateElement>('card-template');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- date input ---------- */

function fillDays(month: number, selected: number): void {
  const max = daysInMonth(month);
  const day = clampDay(month, selected);
  if (daySelect.options.length !== max) {
    daySelect.replaceChildren(
      ...Array.from({ length: max }, (_, i) => {
        const opt = document.createElement('option');
        opt.value = String(i + 1);
        opt.textContent = String(i + 1).padStart(2, '0');
        return opt;
      }),
    );
  }
  daySelect.value = String(day);
}

function setInputs(month: number, day: number): void {
  monthSelect.value = String(month);
  fillDays(month, day);
}

monthSelect.addEventListener('change', () => {
  fillDays(Number(monthSelect.value), Number(daySelect.value));
});

/** True only while the initial hash search runs: that one should not scroll. */
let quiet = false;
/** md of the result currently shown, used to ignore no-op hash changes. */
let currentMd: string | null = null;

form.addEventListener('submit', (event) => {
  event.preventDefault();
  search(Number(monthSelect.value), Number(daySelect.value));
});

function search(month: number, day: number): void {
  window.dispatchEvent(new CustomEvent('mdm:search', { detail: { month, day } }));
}

/* ---------- rendering ---------- */

function buildCard(song: Song, index: number): HTMLElement {
  const frag = cardTemplate.content.cloneNode(true) as DocumentFragment;
  const card = frag.querySelector<HTMLElement>('.card')!;
  card.style.setProperty('--i', String(index));
  card.querySelector('.card__date')!.textContent = formatFullDate(song.date);
  card.querySelector('.card__title')!.textContent = song.title;
  card.querySelector('.card__album')!.textContent = song.album;
  const link = card.querySelector<HTMLAnchorElement>('.card__link')!;
  if (song.spotify) {
    link.href = song.spotify;
    link.querySelector('.card__link-title')!.textContent = `: ${song.title} (abre en una pestaña nueva)`;
  } else {
    link.remove();
  }
  return card;
}

function buildGroup(songs: Song[], startIndex: number, label?: string): HTMLElement {
  const group = document.createElement('section');
  group.className = 'result__group';
  if (label) {
    const p = document.createElement('p');
    p.className = 'eyebrow result__label';
    p.textContent = label;
    group.append(p);
  }
  const cards = document.createElement('div');
  cards.className = 'result__cards';
  cards.append(...songs.map((s, i) => buildCard(s, startIndex + i)));
  group.append(cards);
  return group;
}

function render(result: Result): void {
  const sentence = document.createElement('p');
  sentence.className = 'result__sentence';
  sentence.textContent = resultSentence(result);

  const groups: HTMLElement[] = [];
  if (result.kind === 'exact') {
    groups.push(buildGroup(result.songs, 0));
  } else {
    const { before, after } = result;
    const tie = Boolean(before && after);
    let i = 0;
    for (const [side, match] of [
      ['antes', before],
      ['después', after],
    ] as [string, Match | undefined][]) {
      if (!match) continue;
      groups.push(buildGroup(match.songs, i, tie ? `${side} · ${spokenDate(match.md)}` : undefined));
      i += match.songs.length;
    }
  }

  resultBox.replaceChildren(sentence, ...groups);
}

/* ---------- orchestration ---------- */

window.addEventListener('mdm:search', (event) => {
  const { month, day } = event.detail;
  // Every search scrolls the result into view (form submit, calendar click,
  // hash change) except the initial one from the URL on page load.
  const shouldScroll = !quiet;
  quiet = false;
  let result: Result;
  try {
    result = findSongs(month, day, db);
  } catch {
    return; // invalid date: ignore silently
  }

  setInputs(month, day);
  render(result);
  currentMd = result.md;
  // replaceState does not fire hashchange, so this cannot loop.
  history.replaceState(null, '', `#${result.md}`);
  window.dispatchEvent(new CustomEvent('mdm:result', { detail: { md: result.md } }));

  if (shouldScroll) {
    const { top } = resultBox.getBoundingClientRect();
    // Only scroll when the result starts off-screen (above, e.g. from the
    // calendar) or low enough that the user would not see it.
    if (top < 0 || top > window.innerHeight * 0.75) {
      resultBox.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
    }
  }
});

window.addEventListener('hashchange', () => {
  const parsed = parseHash(location.hash);
  if (!parsed || toMd(parsed.month, parsed.day) === currentMd) return;
  search(parsed.month, parsed.day);
});

/* ---------- boot ---------- */

const fromHash = parseHash(location.hash);
if (fromHash) {
  quiet = true;
  search(fromHash.month, fromHash.day);
} else {
  const today = new Date();
  setInputs(today.getMonth() + 1, today.getDate());
}
