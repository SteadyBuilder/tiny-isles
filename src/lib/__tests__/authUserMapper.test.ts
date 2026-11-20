import assert from 'node:assert/strict';
import test from 'node:test';
import type { User } from '@supabase/supabase-js';
import { mapSupabaseUser } from '../auth/authUserMapper';

test('mapSupabaseUser extracts providers from identities', () => {
  const user = {
    id: 'uid-1',
    email: 'hero@gmail.com',
    app_metadata: {},
    user_metadata: { full_name: '수호자A' },
    identities: [
      {
        id: 'id-1',
        identity_id: 'ident-1',
        user_id: 'uid-1',
        provider: 'google',
        identity_data: { email: 'hero@gmail.com', name: '수호자A' },
        created_at: '2026-11-19T00:00:00Z',
      },
    ],
  } as unknown as User;

  const summary = mapSupabaseUser(user);
  assert.ok(summary);
  assert.deepEqual(summary.providers, ['google']);
  assert.equal(summary.email, 'hero@gmail.com');
  assert.equal(summary.displayName, '수호자A');
});

test('mapSupabaseUser falls back to app_metadata.providers when identities is absent', () => {
  const user = {
    id: 'uid-2',
    email: 'kakao_hero@kakao.com',
    app_metadata: { provider: 'google', providers: ['google', 'kakao'] },
    user_metadata: { name: '기사단장' },
    identities: [],
  } as unknown as User;

  const summary = mapSupabaseUser(user);
  assert.ok(summary);
  assert.deepEqual(new Set(summary.providers), new Set(['google', 'kakao']));
  assert.equal(summary.email, 'kakao_hero@kakao.com');
});

test('mapSupabaseUser returns null for null user', () => {
  assert.equal(mapSupabaseUser(null), null);
});
