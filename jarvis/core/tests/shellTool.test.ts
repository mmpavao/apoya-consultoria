import { describe, it, expect } from 'vitest';
import { validate, DEFAULT_SHELL_POLICY } from '../src/infrastructure/tools/shellTool.js';

describe('shell sandbox validation', () => {
  it('allows a plain allowlisted binary', () => {
    expect(validate('git status', DEFAULT_SHELL_POLICY)).toBeNull();
    expect(validate('ls -la', DEFAULT_SHELL_POLICY)).toBeNull();
  });

  it('blocks non-allowlisted binaries', () => {
    expect(validate('rm -rf /', DEFAULT_SHELL_POLICY)).toMatch(/not allowlisted/);
  });

  it('blocks shell operators (chaining, pipes, redirects, subshells)', () => {
    expect(validate('ls && rm x', DEFAULT_SHELL_POLICY)).toMatch(/Forbidden operator/);
    expect(validate('cat a | grep b', DEFAULT_SHELL_POLICY)).toMatch(/Forbidden operator/);
    expect(validate('echo x > file', DEFAULT_SHELL_POLICY)).toMatch(/Forbidden operator/);
    expect(validate('echo $(whoami)', DEFAULT_SHELL_POLICY)).toMatch(/Forbidden operator/);
  });

  it('blocks sudo', () => {
    expect(validate('sudo ls', DEFAULT_SHELL_POLICY)).toMatch(/sudo|Forbidden/);
  });

  it('blocks sensitive paths', () => {
    expect(validate('cat ~/.ssh/id_rsa', DEFAULT_SHELL_POLICY)).toMatch(/Blocked path|Forbidden/);
  });

  it('rejects empty commands', () => {
    expect(validate('   ', DEFAULT_SHELL_POLICY)).toMatch(/Empty/);
  });
});
