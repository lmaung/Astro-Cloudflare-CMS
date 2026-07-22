import { z } from 'zod';

export const roleKeySchema = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z][a-z0-9-]*$/, 'Use lowercase letters, numbers, and hyphens.');

export const reservedRoleKeys = ['public', 'authenticated', 'member', 'editor', 'page-editor', 'admin'] as const;

export const accessPolicySchema = z
  .object({
    readRoles: z.array(roleKeySchema).min(1).max(32).default(['public']),
    writeRoles: z.array(roleKeySchema).min(1).max(32).default(['admin']),
  })
  .superRefine((policy, context) => {
    if (new Set(policy.readRoles).size !== policy.readRoles.length) {
      context.addIssue({
        code: 'custom',
        path: ['readRoles'],
        message: 'Read roles must be unique.',
      });
    }
    if (new Set(policy.writeRoles).size !== policy.writeRoles.length) {
      context.addIssue({
        code: 'custom',
        path: ['writeRoles'],
        message: 'Write roles must be unique.',
      });
    }
    if (policy.writeRoles.includes('public')) {
      context.addIssue({
        code: 'custom',
        path: ['writeRoles'],
        message: 'Anonymous visitors cannot receive write access.',
      });
    }
  });

export const defaultAccessPolicy = accessPolicySchema.parse({});

export const roleDefinitionSchema = z.object({
  key: roleKeySchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).default(''),
  system: z.boolean().default(false),
});

export const userRoleAssignmentSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  displayName: z.string().trim().max(120).default(''),
  roles: z
    .array(roleKeySchema)
    .max(32)
    .default([])
    .refine((roles) => new Set(roles).size === roles.length, 'Roles must be unique.'),
});

export const authorizationDirectorySchema = z
  .object({
    roles: z.array(roleDefinitionSchema).max(100),
    users: z.array(userRoleAssignmentSchema).max(5000),
  })
  .superRefine((directory, context) => {
    const roles = new Set(directory.roles.map((role) => role.key));
    if (roles.size !== directory.roles.length) {
      context.addIssue({
        code: 'custom',
        path: ['roles'],
        message: 'Role keys must be unique.',
      });
    }
    directory.users.forEach((user, userIndex) => {
      user.roles.forEach((role, roleIndex) => {
        if (role === 'public' || role === 'authenticated') {
          context.addIssue({
            code: 'custom',
            path: ['users', userIndex, 'roles', roleIndex],
            message: `${role} is assigned automatically.`,
          });
        } else if (!roles.has(role)) {
          context.addIssue({
            code: 'custom',
            path: ['users', userIndex, 'roles', roleIndex],
            message: `Unknown role: ${role}.`,
          });
        }
      });
    });
  });

export type AccessPolicy = z.infer<typeof accessPolicySchema>;
export type RoleDefinition = z.infer<typeof roleDefinitionSchema>;
export type UserRoleAssignment = z.infer<typeof userRoleAssignmentSchema>;
export type AuthorizationDirectory = z.infer<typeof authorizationDirectorySchema>;

export type Principal = {
  authenticated: boolean;
  email?: string;
  roles: ReadonlySet<string>;
};

export function principalFor(email?: string, assignedRoles: string[] = []): Principal {
  const normalizedEmail = email?.trim().toLowerCase();
  return {
    authenticated: Boolean(normalizedEmail),
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    roles: new Set(['public', ...(normalizedEmail ? ['authenticated'] : []), ...assignedRoles]),
  };
}

export function canRead(policy: AccessPolicy, principal: Principal): boolean {
  return policy.readRoles.some((role) => principal.roles.has(role)) || canWrite(policy, principal);
}

export function canWrite(policy: AccessPolicy, principal: Principal): boolean {
  return policy.writeRoles.some((role) => principal.roles.has(role));
}

export function validatePolicyRoles(policy: AccessPolicy, knownRoles: Iterable<string>): void {
  const known = new Set(['public', 'authenticated', ...knownRoles]);
  const unknown = [...policy.readRoles, ...policy.writeRoles].filter((role) => !known.has(role));
  if (unknown.length)
    throw new Error(`Unknown access role${unknown.length === 1 ? '' : 's'}: ${[...new Set(unknown)].join(', ')}.`);
}
