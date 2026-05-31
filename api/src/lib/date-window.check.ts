import assert from 'node:assert/strict';
import { parseDateWindow } from './date-window';

assert.deepEqual(
  parseDateWindow(
    { startDate: '2026-06-01', endDate: '2026-06-10', flexibility: 'plus_minus_3' },
    { requireStartDate: true, rejectPastStartDate: true, today: '2026-05-31' },
  ),
  {
    data: {
      startDate: '2026-06-01',
      endDate: '2026-06-10',
      flexibility: 'plus_minus_3',
    },
  },
);

assert.deepEqual(
  parseDateWindow(
    { startDate: '2026-05-30', flexibility: 'exact' },
    { requireStartDate: true, rejectPastStartDate: true, today: '2026-05-31' },
  ),
  { error: 'dateWindow.startDate must not be in the past' },
);

assert.deepEqual(
  parseDateWindow(
    { startDate: '2026-05-30', flexibility: 'exact' },
    { requireStartDate: true, today: '2026-05-31' },
  ),
  {
    data: {
      startDate: '2026-05-30',
      endDate: '',
      flexibility: 'exact',
    },
  },
);

console.log('Date window validation check passed.');
