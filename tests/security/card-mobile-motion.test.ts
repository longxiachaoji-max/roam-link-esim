import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const cardExperience = readFileSync(new URL('../../src/app/card/card-experience.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../../src/app/globals.css', import.meta.url), 'utf8');

test('mobile card motion responds to scrolling without requiring orientation permission', () => {
  assert.match(cardExperience, /matchMedia\('\(pointer: coarse\)'\)/);
  assert.match(cardExperience, /addEventListener\('scroll', updateScrollMotion/);
  assert.match(cardExperience, /--card-scroll-rotate-x/);
  assert.match(cardExperience, /--card-scroll-rotate-y/);
  assert.match(cardExperience, /--card-light-x/);
  assert.match(cardExperience, /data-scroll-active="false"/);
});

test('scroll tilt is composed with pointer motion and respects reduced-motion preferences', () => {
  assert.match(globalStyles, /rotateX\(calc\(var\(--card-rotate-x\) \+ var\(--card-scroll-rotate-x\)\)\)/);
  assert.match(globalStyles, /card-glass-shell\[data-scroll-active='true'\]/);
  assert.match(globalStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(globalStyles, /card-glass-shell\[data-scroll-active='true'\],[\s\S]*transform: none/);
});
