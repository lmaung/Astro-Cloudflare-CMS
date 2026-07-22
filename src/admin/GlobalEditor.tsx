import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { useEffect, useState } from 'react';
import type { RJSFSchema } from '@rjsf/utils';
import { loadGlobal, saveGlobal } from './local-gateway';

export function GlobalEditor({ definition }: { definition: { key: string; title: string; description: string; schema: RJSFSchema } }) {
  const [data, setData] = useState<unknown>(); const [revision, setRevision] = useState(''); const [dirty, setDirty] = useState(false); const [message, setMessage] = useState('Loading…');
  useEffect(() => { setData(undefined); setDirty(false); loadGlobal(definition.key).then((result) => { setData(result.data); setRevision(result.revision); setMessage('Published global content loaded.'); }).catch((error: Error) => setMessage(error.message)); }, [definition.key]);
  async function save() { const result = await saveGlobal(definition.key, data, revision, crypto.randomUUID()); setRevision(result.revision); setDirty(false); setMessage(result.mode === 'remote' ? 'Content saved. Refresh the website to load the latest data; no deployment was triggered.' : 'Saved locally without a Git commit.'); }
  return <section className="admin-editor" aria-labelledby="global-heading"><div className="admin-editor__heading"><div><p className="admin-kicker">Global content</p><h2 id="global-heading">{definition.title}</h2><p>{definition.description}</p></div><button className="button button--primary" disabled={!dirty} onClick={save}>Save {definition.title.toLowerCase()}</button></div><div className="admin-status" role="status">{message}</div>{data !== undefined && <Form schema={definition.schema} formData={data} validator={validator} onChange={(event) => { setData(event.formData); setDirty(true); }} showErrorList={false} uiSchema={{ 'ui:submitButtonOptions': { norender: true } }} />}</section>;
}
