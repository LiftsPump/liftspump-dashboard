const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('navigation css includes mobile breakpoint', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'Navigation.module.css'), 'utf8');
  assert.match(css, /@media\s*\(max-width: 600px\)/);
});

test('header css includes mobile breakpoint', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'Header.module.css'), 'utf8');
  assert.match(css, /@media\s*\(max-width: 600px\)/);
});

test('head.tsx defines viewport meta tag', () => {
  const head = fs.readFileSync(path.join(__dirname, '../../app/head.tsx'), 'utf8');
  assert.match(head, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
});
