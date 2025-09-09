import test from 'node:test';
import assert from 'node:assert/strict';
import { accentFor } from '../navigation-utils';

test('accentFor returns expected colors', () => {
  assert.equal(accentFor('routines'), '#60a5fa');
  assert.equal(accentFor('videos'), '#f87171');
  assert.equal(accentFor('users'), '#1AE080');
  assert.equal(accentFor('payments'), '#a78bfa');
  assert.equal(accentFor('other'), '#1AE080');
});
