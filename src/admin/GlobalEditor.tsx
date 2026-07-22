import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { useEffect, useState } from 'react';
import type { RJSFSchema } from '@rjsf/utils';
import { loadGlobal, saveGlobal } from './local-gateway';
import { NavigationEditor } from './NavigationEditor';

export function GlobalEditor({ definition }: { definition: { key: string; title: string; description: string; schema: RJSFSchema } }) {
  if (definition.key === 'navigation') return <NavigationEditor title={definition.title} description={definition.description} />;
  return <SchemaGlobalEditor definition={definition} />;
}

function SchemaGlobalEditor({ definition }: { definition: { key: string; title: string; description: string; schema: RJSFSchema } }) {
  const [data, setData] = useState<unknown>();
  const [revision, setRevision] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('Loading…');
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setData(undefined); setDirty(false); setError(false); setMessage('Loading…');
    loadGlobal(definition.key).then((result) => {
      if (!active) return;
      setData(result.data); setRevision(result.revision); setMessage('Published global content loaded.');
    }).catch((reason: Error) => { if (active) { setError(true); setMessage(reason.message); } });
    return () => { active = false; };
  }, [definition.key]);

  async function save() {
    if (!dirty || saving) return;
    setSaving(true); setError(false); setMessage('Validating and saving content…');
    try {
      const result = await saveGlobal(definition.key, data, revision, crypto.randomUUID());
      setData(result.data); setRevision(result.revision); setDirty(false);
      setMessage(result.mode === 'remote' ? 'Content saved. Refresh the website to load the latest data; no deployment was triggered.' : 'Saved locally without a Git commit.');
    } catch (reason) { setError(true); setMessage(reason instanceof Error ? reason.message : 'Save failed.'); }
    finally { setSaving(false); }
  }

  return <section className="admin-editor" aria-labelledby="global-heading">
    <div className="admin-editor__heading"><div><p className="admin-kicker">Global content</p><h1 id="global-heading">{definition.title}</h1><p>{definition.description}</p></div><button className="button button--primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Working…' : `Save ${definition.title.toLowerCase()}`}</button></div>
    <div className="admin-status" data-kind={error ? 'error' : undefined} role={error ? 'alert' : 'status'} aria-live="polite">{message}</div>
    {data !== undefined && <Form schema={definition.schema} formData={data} validator={validator} onChange={(event) => { setData(event.formData); setDirty(true); }} showErrorList={false} uiSchema={{ 'ui:submitButtonOptions': { norender: true } }} />}
  </section>;
}
