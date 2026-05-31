import assert from 'node:assert/strict';
import type { Response } from 'express';
import { responseRequestId, sendError } from './http-response';

function mockResponse(requestId?: string) {
  const calls: Array<{ status: number; body: unknown }> = [];
  const res = {
    locals: requestId ? { requestId } : {},
    status(status: number) {
      return {
        json(body: unknown) {
          calls.push({ status, body });
        },
      };
    },
  } as unknown as Response;

  return { res, calls };
}

{
  const { res, calls } = mockResponse('req_123');
  assert.equal(responseRequestId(res), 'req_123');
  sendError(res, 400, 'Bad input');
  assert.deepEqual(calls, [{ status: 400, body: { error: 'Bad input', requestId: 'req_123' } }]);
}

{
  const { res, calls } = mockResponse('req_456');
  sendError(res, 428, 'User not found — call POST /api/users/me first', 'user_not_provisioned');
  assert.deepEqual(calls, [{
    status: 428,
    body: {
      error: 'User not found — call POST /api/users/me first',
      code: 'user_not_provisioned',
      requestId: 'req_456',
    },
  }]);
}

{
  const { res, calls } = mockResponse();
  assert.equal(responseRequestId(res), 'unknown');
  sendError(res, 500, 'Internal server error');
  assert.deepEqual(calls, [{ status: 500, body: { error: 'Internal server error', requestId: 'unknown' } }]);
}

console.log('HTTP response helper checks passed');
