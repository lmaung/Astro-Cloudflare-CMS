import Form from '@rjsf/core';
import type { IChangeEvent } from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { useEffect, useMemo, useState } from 'react';
import catalogSource from '../../generated/schemas/component-catalog.json';
import type { BlockEnvelope, PageDocument } from '../domain/content';
import { loadLocalPage, saveLocalPage } from './local-gateway';
import type { Catalog } from './types';

const catalog = catalogSource as Catalog;

type Status =
  | { kind: 'loading'; message: string }
  | { kind: 'ready'; message: string }
  | { kind: 'saving'; message: string }
  | { kind: 'saved'; message: string }
  | { kind: 'error'; message: string };

function newId(type: string): string {
  return `${type.replace('/', '-')}-${crypto.randomUUID()}`;
}

export default function AdminApp() {
  const [page, setPage] = useState<PageDocument | null>(null);
  const [revision, setRevision] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'loading', message: 'Loading local content…' });

  useEffect(() => {
    loadLocalPage()
      .then((result) => {
        setPage(result.data);
        setRevision(result.revision);
        setSelectedId(result.data.blocks[0]?.id ?? null);
        setStatus({ kind: 'ready', message: 'Local content loaded. Changes are not committed automatically.' });
      })
      .catch((error: Error) => setStatus({ kind: 'error', message: error.message }));
  }, []);

  const selectedIndex = page?.blocks.findIndex((block) => block.id === selectedId) ?? -1;
  const selectedBlock = selectedIndex >= 0 ? page?.blocks[selectedIndex] : undefined;
  const selectedDefinition = useMemo(
    () => catalog.blocks.find((definition) => definition.type === selectedBlock?.type),
    [selectedBlock?.type],
  );

  function updateBlocks(blocks: BlockEnvelope[], nextSelectedId = selectedId) {
    if (!page) return;
    setPage({ ...page, blocks });
    setSelectedId(nextSelectedId);
    setDirty(true);
    setStatus({ kind: 'ready', message: 'Unsaved local changes.' });
  }

  function moveSelected(offset: number) {
    if (!page || selectedIndex < 0) return;
    const destination = selectedIndex + offset;
    if (destination < 0 || destination >= page.blocks.length) return;
    const blocks = [...page.blocks];
    const [block] = blocks.splice(selectedIndex, 1);
    if (!block) return;
    blocks.splice(destination, 0, block);
    updateBlocks(blocks);
  }

  function addBlock(type: string) {
    if (!page) return;
    const definition = catalog.blocks.find((item) => item.type === type);
    if (!definition) return;
    const block: BlockEnvelope = {
      id: newId(type),
      type,
      status: 'active',
      content: structuredClone(definition.defaults),
    };
    updateBlocks([...page.blocks, block], block.id);
  }

  function duplicateSelected() {
    if (!page || !selectedBlock || selectedIndex < 0) return;
    const duplicate = structuredClone(selectedBlock);
    duplicate.id = newId(duplicate.type);
    const blocks = [...page.blocks];
    blocks.splice(selectedIndex + 1, 0, duplicate);
    updateBlocks(blocks, duplicate.id);
  }

  function deleteSelected() {
    if (!page || !selectedBlock || selectedIndex < 0) return;
    if (!window.confirm(`Delete this ${selectedDefinition?.editor.title ?? 'block'}?`)) return;
    const blocks = page.blocks.filter((block) => block.id !== selectedBlock.id);
    updateBlocks(blocks, blocks[Math.min(selectedIndex, blocks.length - 1)]?.id ?? null);
  }

  function updateSelectedContent(event: IChangeEvent) {
    if (!page || selectedIndex < 0 || !selectedBlock) return;
    const blocks = [...page.blocks];
    blocks[selectedIndex] = { ...selectedBlock, content: event.formData };
    updateBlocks(blocks);
  }

  async function save() {
    if (!page || !dirty) return;
    setStatus({ kind: 'saving', message: 'Saving to the sibling content repository…' });
    try {
      const result = await saveLocalPage(page, revision);
      setPage(result.data);
      setRevision(result.revision);
      setDirty(false);
      setStatus({ kind: 'saved', message: 'Saved locally. No Git commit was created.' });
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Save failed.' });
    }
  }

  if (!page) {
    return (
      <div className="admin-state" role="status">
        <h1>Content editor</h1>
        <p>{status.message}</p>
        {status.kind === 'error' && <a href="/admin">Try again</a>}
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <a className="admin-brand" href="/">Astro CMS</a>
          <p>Local vertical slice</p>
        </div>
        <div className="admin-header__actions">
          <a className="button button--secondary" href="/" target="_blank" rel="noreferrer">View site</a>
          <button className="button button--primary" type="button" onClick={save} disabled={!dirty || status.kind === 'saving'}>
            {status.kind === 'saving' ? 'Saving…' : 'Save locally'}
          </button>
        </div>
      </header>

      <div className="admin-status" data-kind={status.kind} role={status.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
        {status.message}
      </div>

      <div className="admin-workspace">
        <aside className="admin-sidebar" aria-labelledby="blocks-heading">
          <div className="admin-sidebar__heading">
            <div>
              <p className="admin-kicker">Page</p>
              <h1 id="blocks-heading">{page.title}</h1>
            </div>
            <label>
              <span>Add block</span>
              <select value="" onChange={(event) => { if (event.target.value) addBlock(event.target.value); }}>
                <option value="">Choose…</option>
                {catalog.blocks.map((definition) => <option key={definition.type} value={definition.type}>{definition.editor.title}</option>)}
              </select>
            </label>
          </div>
          <ol className="block-list">
            {page.blocks.map((block, index) => {
              const definition = catalog.blocks.find((item) => item.type === block.type);
              return (
                <li key={block.id}>
                  <button
                    type="button"
                    className="block-list__item"
                    aria-current={block.id === selectedId ? 'true' : undefined}
                    onClick={() => setSelectedId(block.id)}
                  >
                    <span>{index + 1}</span>
                    <span><strong>{definition?.editor.title ?? block.type}</strong><small>{definition?.editor.description}</small></span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="admin-editor" aria-labelledby="editor-heading">
          {selectedBlock && selectedDefinition ? (
            <>
              <div className="admin-editor__heading">
                <div>
                  <p className="admin-kicker">Block {selectedIndex + 1}</p>
                  <h2 id="editor-heading">{selectedDefinition.editor.title}</h2>
                  <p>{selectedDefinition.editor.description}</p>
                </div>
                <div className="editor-actions" aria-label="Block actions">
                  <button type="button" onClick={() => moveSelected(-1)} disabled={selectedIndex === 0}>Move up</button>
                  <button type="button" onClick={() => moveSelected(1)} disabled={selectedIndex === page.blocks.length - 1}>Move down</button>
                  <button type="button" onClick={duplicateSelected}>Duplicate</button>
                  <button className="danger-action" type="button" onClick={deleteSelected}>Delete</button>
                </div>
              </div>
              <Form
                schema={selectedDefinition.schema}
                formData={selectedBlock.content}
                validator={validator}
                onChange={updateSelectedContent}
                liveValidate="onBlur"
                showErrorList={false}
                uiSchema={{ 'ui:submitButtonOptions': { norender: true } }}
              />
            </>
          ) : (
            <div className="admin-empty"><h2 id="editor-heading">No block selected</h2><p>Add or select a block to edit its content.</p></div>
          )}
        </section>
      </div>
    </div>
  );
}
