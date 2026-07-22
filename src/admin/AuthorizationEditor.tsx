import { useEffect, useMemo, useState } from 'react';
import type { AuthorizationDirectory } from '../domain/authorization';
import { loadAuthorization, saveAuthorization } from './local-gateway';

function newRoleKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function AuthorizationEditor() {
  const [directory, setDirectory] = useState<AuthorizationDirectory>();
  const [currentEmail, setCurrentEmail] = useState('');
  const [revision, setRevision] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('Loading private role assignments…');
  const [error, setError] = useState(false);
  const assignableRoles = useMemo(
    () => directory?.roles.filter((role) => role.key !== 'public' && role.key !== 'authenticated') ?? [],
    [directory],
  );

  useEffect(() => {
    loadAuthorization()
      .then((result) => {
        setDirectory(result.data);
        setCurrentEmail(result.currentUser.email);
        setRevision(result.revision);
        setMessage('Git-backed role assignments loaded.');
      })
      .catch((reason: Error) => {
        setError(true);
        setMessage(reason.message);
      });
  }, []);

  function update(next: AuthorizationDirectory) {
    setDirectory(next);
    setDirty(true);
    setError(false);
    setMessage('Unsaved authorization changes.');
  }
  async function save() {
    if (!directory || !dirty || saving) return;
    setSaving(true);
    setError(false);
    setMessage('Validating and saving authorization data to GitHub…');
    try {
      const result = await saveAuthorization(directory, revision);
      setDirectory(result.data);
      setCurrentEmail(result.currentUser.email);
      setRevision(result.revision);
      setDirty(false);
      setMessage('Roles and assignments saved to the content repository.');
    } catch (reason) {
      setError(true);
      setMessage(reason instanceof Error ? reason.message : 'Authorization data could not be saved.');
    } finally {
      setSaving(false);
    }
  }
  function addRole() {
    if (!directory) return;
    const name = window.prompt('Role name');
    if (!name?.trim()) return;
    const key = newRoleKey(name);
    if (!key || directory.roles.some((role) => role.key === key)) {
      setError(true);
      setMessage('Use a unique role name containing letters, numbers, or hyphens.');
      return;
    }
    update({
      ...directory,
      roles: [...directory.roles, { key, name: name.trim(), description: '', system: false }],
    });
  }
  function addUser() {
    if (!directory) return;
    const email = window.prompt('User email address')?.trim().toLowerCase();
    if (!email) return;
    if (directory.users.some((user) => user.email === email)) {
      setError(true);
      setMessage('That user already has an assignment.');
      return;
    }
    update({
      ...directory,
      users: [...directory.users, { email, displayName: '', roles: [] }],
    });
  }

  return (
    <section className="admin-editor authorization-editor" aria-labelledby="authorization-heading">
      <div className="admin-editor__heading">
        <div>
          <p className="admin-kicker">Private access directory</p>
          <h1 id="authorization-heading">Users and roles</h1>
          <p>
            Define reusable roles and assign them to authenticated email identities. Public and authenticated roles are
            automatic. Cloudflare Access remains the gate for entering this admin area.
          </p>
        </div>
        <button className="button button--primary" type="button" disabled={!dirty || saving} onClick={save}>
          {saving ? 'Working…' : 'Save assignments'}
        </button>
      </div>
      <div
        className="admin-status"
        data-kind={error ? 'error' : undefined}
        role={error ? 'alert' : 'status'}
        aria-live="polite"
      >
        {message}
      </div>
      {directory && (
        <div className="authorization-grid">
          <section className="authorization-panel" aria-labelledby="roles-heading">
            <div className="panel-heading">
              <div>
                <h2 id="roles-heading">Roles</h2>
                <p>{directory.roles.length} available roles</p>
              </div>
              <button className="button button--secondary" type="button" onClick={addRole}>
                Add role
              </button>
            </div>
            <ul className="authorization-list">
              {directory.roles.map((role, index) => (
                <li key={role.key}>
                  <div className="authorization-list__heading">
                    <label>
                      Role name
                      <input
                        value={role.name}
                        disabled={role.system}
                        onChange={(event) =>
                          update({
                            ...directory,
                            roles: directory.roles.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, name: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <code>{role.key}</code>
                  </div>
                  <label>
                    Description
                    <textarea
                      value={role.description}
                      disabled={role.key === 'public' || role.key === 'authenticated'}
                      onChange={(event) =>
                        update({
                          ...directory,
                          roles: directory.roles.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, description: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  {!role.system && (
                    <button
                      className="button danger-action"
                      type="button"
                      onClick={() => {
                        if (directory.users.some((user) => user.roles.includes(role.key))) {
                          setError(true);
                          setMessage('Remove this role from every user before deleting it.');
                          return;
                        }
                        update({
                          ...directory,
                          roles: directory.roles.filter((item) => item.key !== role.key),
                        });
                      }}
                    >
                      Delete role
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section className="authorization-panel" aria-labelledby="users-heading">
            <div className="panel-heading">
              <div>
                <h2 id="users-heading">User assignments</h2>
                <p>Signed in as {currentEmail || 'an administrator'}</p>
              </div>
              <button className="button button--secondary" type="button" onClick={addUser}>
                Add user
              </button>
            </div>
            {directory.users.length ? (
              <ul className="authorization-list">
                {directory.users.map((user, index) => (
                  <li key={user.email}>
                    <div className="authorization-list__heading">
                      <label>
                        Display name
                        <input
                          value={user.displayName}
                          onChange={(event) =>
                            update({
                              ...directory,
                              users: directory.users.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, displayName: event.target.value } : item,
                              ),
                            })
                          }
                        />
                      </label>
                      <strong>{user.email}</strong>
                    </div>
                    <fieldset>
                      <legend>Assigned roles</legend>
                      <div className="role-options">
                        {assignableRoles.map((role) => (
                          <label className="checkbox-field" key={role.key}>
                            <input
                              type="checkbox"
                              checked={user.roles.includes(role.key)}
                              onChange={(event) =>
                                update({
                                  ...directory,
                                  users: directory.users.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          roles: event.target.checked
                                            ? [...item.roles, role.key]
                                            : item.roles.filter((key) => key !== role.key),
                                        }
                                      : item,
                                  ),
                                })
                              }
                            />
                            <span>{role.name}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <button
                      className="button danger-action"
                      type="button"
                      onClick={() =>
                        update({
                          ...directory,
                          users: directory.users.filter((item) => item.email !== user.email),
                        })
                      }
                    >
                      Remove assignment
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty">
                <h3>No user assignments</h3>
                <p>Add an authenticated email identity, then select one or more roles.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
