import { describe, expect, it } from 'vitest';
import { accessPolicySchema, canRead, canWrite, principalFor, validatePolicyRoles } from './authorization';

describe('role-list authorization', () => {
  const policy = accessPolicySchema.parse({
    readRoles: ['member', 'editor', 'admin'],
    writeRoles: ['page-editor', 'admin'],
  });

  it('grants access through additive roles and makes write imply read', () => {
    expect(canRead(policy, principalFor('member@example.com', ['member']))).toBe(true);
    expect(canWrite(policy, principalFor('editor@example.com', ['editor']))).toBe(false);
    expect(canRead(policy, principalFor('writer@example.com', ['page-editor']))).toBe(true);
    expect(canWrite(policy, principalFor('writer@example.com', ['page-editor']))).toBe(true);
  });

  it('assigns public and authenticated roles implicitly', () => {
    expect(principalFor().roles.has('public')).toBe(true);
    expect(principalFor().roles.has('authenticated')).toBe(false);
    expect(principalFor('user@example.com').roles.has('authenticated')).toBe(true);
  });

  it('rejects anonymous writes and unknown policy roles', () => {
    expect(() =>
      accessPolicySchema.parse({
        readRoles: ['public'],
        writeRoles: ['public'],
      }),
    ).toThrow();
    expect(() => validatePolicyRoles(policy, ['member', 'editor', 'admin'])).toThrow('page-editor');
  });
});
