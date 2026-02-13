import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/modules/auth/auth.service.js';

function makeStore() {
  return {
    users: new Map(), usersByEmail: new Map(), sessions: new Map(), refreshTokens: new Map(), watchHistory: new Map(), watchlist: new Map(), ratings: new Map(),
  };
}

test('register + login + me', () => {
  const auth = new AuthService(makeStore());
  auth.register({ email: 'a@example.com', username: 'alice', password: 'pw' });
  const login = auth.login({ email: 'a@example.com', password: 'pw' });
  const me = auth.me(login.accessToken);
  assert.equal(me.email, 'a@example.com');
});
