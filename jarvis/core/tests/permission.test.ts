import { describe, it, expect } from 'vitest';
import {
  PermissionService,
  InMemoryPermissionStore,
  matchPattern,
  subjectsFor,
} from '../src/application/PermissionService.js';
import type { PermissionRule } from '../src/domain/entities/Permission.js';

const rule = (over: Partial<PermissionRule>): PermissionRule => ({
  id: 'r',
  createdAt: 't',
  updatedAt: 't',
  deletedAt: null,
  scope: 'fs.path',
  pattern: '/tmp/*',
  level: 'write',
  enabled: true,
  ...over,
});

describe('PermissionService', () => {
  it('auto-allows read regardless of allowlist', () => {
    const svc = new PermissionService(new InMemoryPermissionStore([]));
    expect(svc.evaluate('read', [{ scope: 'fs.path', value: '/anywhere' }])).toBe('auto');
  });

  it('always escalates destructive to approval', () => {
    const svc = new PermissionService(new InMemoryPermissionStore([rule({ level: 'destructive' })]));
    expect(svc.evaluate('destructive', [{ scope: 'fs.path', value: '/tmp/x' }])).toBe('approval');
  });

  it('auto-allows write when covered by an allowlist rule', () => {
    const svc = new PermissionService(new InMemoryPermissionStore([rule({})]));
    expect(svc.evaluate('write', [{ scope: 'fs.path', value: '/tmp/file.txt' }])).toBe('auto');
  });

  it('requires approval for write outside the allowlist', () => {
    const svc = new PermissionService(new InMemoryPermissionStore([rule({})]));
    expect(svc.evaluate('write', [{ scope: 'fs.path', value: '/home/user/secret' }])).toBe('approval');
  });

  it('requires approval for write with no subjects', () => {
    const svc = new PermissionService(new InMemoryPermissionStore([rule({})]));
    expect(svc.evaluate('write', [])).toBe('approval');
  });

  it('denies blocked sensitive paths even when allowlisted broadly', () => {
    const svc = new PermissionService(new InMemoryPermissionStore([rule({ pattern: '*' })]));
    expect(svc.evaluate('write', [{ scope: 'fs.path', value: '/home/u/.ssh/id_rsa' }])).toBe('denied');
  });

  it('ignores disabled and soft-deleted rules', () => {
    const svc = new PermissionService(
      new InMemoryPermissionStore([rule({ enabled: false }), rule({ deletedAt: 'x' })]),
    );
    expect(svc.evaluate('write', [{ scope: 'fs.path', value: '/tmp/x' }])).toBe('approval');
  });
});

describe('matchPattern', () => {
  it('matches wildcards and exact', () => {
    expect(matchPattern('*', 'anything')).toBe(true);
    expect(matchPattern('/tmp/*', '/tmp/a/b')).toBe(true);
    expect(matchPattern('/tmp/x', '/tmp/x')).toBe(true);
    expect(matchPattern('/tmp/x', '/tmp/y')).toBe(false);
  });
});

describe('subjectsFor', () => {
  it('extracts fs paths', () => {
    expect(subjectsFor('fs.move', { from: '/a', to: '/b' })).toEqual([
      { scope: 'fs.path', value: '/a' },
      { scope: 'fs.path', value: '/b' },
    ]);
  });
  it('extracts the shell binary', () => {
    expect(subjectsFor('shell.run', { command: 'git status' })).toEqual([
      { scope: 'shell.bin', value: 'git' },
    ]);
  });
});
