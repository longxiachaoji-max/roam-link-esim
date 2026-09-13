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
  assert.match(cardExperience, /--card-light-scroll-x/);
  assert.match(cardExperience, /--card-light-pointer-x/);
  assert.doesNotMatch(cardExperience, /--card-scroll-scale/);
  assert.match(cardExperience, /data-scroll-active="false"/);
});

test('scroll tilt uses compositor-friendly motion and respects reduced-motion preferences', () => {
  assert.match(globalStyles, /rotateX\(calc\(var\(--card-rotate-x\) \+ var\(--card-scroll-rotate-x\)\)\)/);
  assert.match(globalStyles, /card-glass-shell\[data-scroll-active='true'\][\s\S]*transition: none/);
  assert.match(globalStyles, /calc\(var\(--card-light-pointer-x\) \+ var\(--card-light-scroll-x\)\)/);
  assert.match(globalStyles, /@media \(pointer: coarse\)[\s\S]*backdrop-filter: blur\(22px\)/);
  assert.match(globalStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(globalStyles, /card-glass-shell\[data-scroll-active='true'\],[\s\S]*transform: none/);
});
