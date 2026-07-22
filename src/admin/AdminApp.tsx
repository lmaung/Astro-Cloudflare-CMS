import Form from '@rjsf/core';
import type { IChangeEvent } from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { useEffect, useMemo, useState } from 'react';
import catalogSource from '../../generated/schemas/component-catalog.json';
import type { BlockEnvelope, PageDocument } from '../domain/content';
import { resolveReusableBlock, type ReusableLibrary } from '../domain/reusables';
import { createPage, deletePage, loadGlobal, loadPage, loadPages, savePage } from './local-gateway';
import type { Catalog, EditorMode, PageSummary } from './types';
import { GlobalEditor } from './GlobalEditor';

const catalog = catalogSource as Catalog;
type Section = 'pages' | 'site-settings' | 'navigation' | 'reusable-blocks' | 'media-library';
type Status = { kind: 'loading' | 'ready' | 'saving' | 'saved' | 'error'; message: string };

function newId(type: string): string { return `${type.replace('/', '-')}-${crypto.randomUUID()}`; }
function slugFromTitle(title: string): string { return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80); }

export default function AdminApp() {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [collectionRevision, setCollectionRevision] = useState('');
  const [page, setPage] = useState<PageDocument | null>(null);
  const [revision, setRevision] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<EditorMode | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'loading', message: 'Loading pages…' });
  const [section, setSection] = useState<Section>('pages');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [reusableLibrary, setReusableLibrary] = useState<ReusableLibrary>({ blocks: [] });

  async function selectPage(slug: string, force = false) {
    if (!force && dirty && !window.confirm('Discard the unsaved changes on this page?')) return;
    setStatus({ kind: 'loading', message: 'Loading page…' });
    try {
      const result = await loadPage(slug);
      setPage(result.data); setRevision(result.revision); setMode(result.mode);
      setSelectedId(result.data.blocks[0]?.id ?? null); setDirty(false);
      setStatus({ kind: 'ready', message: result.mode === 'local' ? 'Local page loaded.' : 'Published page loaded. Saves publish immediately without redeploying.' });
    } catch (error) { setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Page could not be loaded.' }); }
  }

  async function refreshPages(preferredSlug?: string) {
    const result = await loadPages();
    setPages(result.data); setCollectionRevision(result.revision); setMode(result.mode);
    const slug = preferredSlug ?? result.data.find((item) => item.slug === 'home')?.slug ?? result.data[0]?.slug;
    if (slug) await selectPage(slug, true);
    else { setPage(null); setStatus({ kind: 'ready', message: 'No pages yet. Create the first page.' }); }
  }

  useEffect(() => { refreshPages().catch((error: Error) => setStatus({ kind: 'error', message: error.message })); }, []);
  useEffect(() => { loadGlobal('reusable-blocks').then((result) => setReusableLibrary(result.data as ReusableLibrary)).catch(() => setReusableLibrary({ blocks: [] })); }, [section]);

  const selectedIndex = page?.blocks.findIndex((block) => block.id === selectedId) ?? -1;
  const selectedBlock = selectedIndex >= 0 ? page?.blocks[selectedIndex] : undefined;
  const selectedDefinition = useMemo(() => catalog.blocks.find((definition) => definition.type === selectedBlock?.type), [selectedBlock?.type]);

  function markPage(next: PageDocument, nextSelectedId = selectedId) {
    setPage(next); setSelectedId(nextSelectedId); setDirty(true);
    setStatus({ kind: 'ready', message: mode === 'remote' ? 'Unpublished page changes.' : 'Unsaved local changes.' });
  }
  function updateBlocks(blocks: BlockEnvelope[], nextSelectedId = selectedId) { if (page) markPage({ ...page, blocks }, nextSelectedId); }
  function moveSelected(offset: number) {
    if (!page || selectedIndex < 0) return; const destination = selectedIndex + offset;
    if (destination < 0 || destination >= page.blocks.length) return;
    const blocks = [...page.blocks]; const [block] = blocks.splice(selectedIndex, 1); if (!block) return;
    blocks.splice(destination, 0, block); updateBlocks(blocks);
  }
  function addBlock(type: string) {
    if (!page) return; const definition = catalog.blocks.find((item) => item.type === type); if (!definition) return;
    const block: BlockEnvelope = { id: newId(type), type, status: 'active', content: structuredClone(definition.defaults) };
    updateBlocks([...page.blocks, block], block.id);
  }
  function duplicateSelected() {
    if (!page || !selectedBlock || selectedIndex < 0) return;
    const duplicate = structuredClone(selectedBlock); duplicate.id = newId(duplicate.type);
    const blocks = [...page.blocks]; blocks.splice(selectedIndex + 1, 0, duplicate); updateBlocks(blocks, duplicate.id);
  }
  function toggleSelectedVisibility() {
    if (!page || !selectedBlock || selectedIndex < 0) return;
    const blocks = [...page.blocks];
    blocks[selectedIndex] = { ...selectedBlock, status: selectedBlock.status === 'active' ? 'hidden' : 'active' };
    updateBlocks(blocks);
  }
  function deleteSelected() {
    if (!page || !selectedBlock || selectedIndex < 0 || !window.confirm(`Delete this ${selectedDefinition?.editor.title ?? 'block'}? The deletion is not published until you save.`)) return;
    const blocks = page.blocks.filter((block) => block.id !== selectedBlock.id);
    updateBlocks(blocks, blocks[Math.min(selectedIndex, blocks.length - 1)]?.id ?? null);
  }
  function updateSelectedContent(event: IChangeEvent) {
    if (!page || selectedIndex < 0 || !selectedBlock) return;
    const blocks = [...page.blocks];
    if (selectedBlock.reusable) {
      const source = reusableLibrary.blocks.find((entry) => entry.id === selectedBlock.reusable?.sourceId);
      const overrides = source ? Object.fromEntries(source.refinableFields.filter((field) => JSON.stringify((event.formData as Record<string, unknown>)[field]) !== JSON.stringify((source.content as Record<string, unknown>)[field])).map((field) => [field, (event.formData as Record<string, unknown>)[field]])) : selectedBlock.reusable.overrides;
      blocks[selectedIndex] = { ...selectedBlock, content: event.formData, reusable: { ...selectedBlock.reusable, overrides } };
    } else blocks[selectedIndex] = { ...selectedBlock, content: event.formData };
    updateBlocks(blocks);
  }
  function attachReusable(sourceId: string) {
    if (!page || selectedIndex < 0 || !selectedBlock) return; const source = reusableLibrary.blocks.find((entry) => entry.id === sourceId); if (!source) return;
    const blocks = [...page.blocks]; blocks[selectedIndex] = { ...selectedBlock, type: source.type, content: structuredClone(source.content), reusable: { sourceId, overrides: {} } }; updateBlocks(blocks);
  }
  function detachReusable() {
    if (!page || selectedIndex < 0 || !selectedBlock?.reusable) return; const blocks = [...page.blocks]; const resolved = resolveReusableBlock(selectedBlock, reusableLibrary); blocks[selectedIndex] = { id: resolved.id, type: resolved.type, status: resolved.status, content: structuredClone(resolved.content) }; updateBlocks(blocks);
  }

  async function save() {
    if (!page || !dirty) return;
    setStatus({ kind: 'saving', message: 'Validating and saving page…' });
    try {
      const result = await savePage(page, revision, crypto.randomUUID());
      setPage(result.data); setRevision(result.revision); setMode(result.mode); setDirty(false);
      setPages((current) => current.map((item) => item.slug === result.data.slug ? { id: result.data.id, slug: result.data.slug, status: result.data.status, title: result.data.title } : item));
      setStatus({ kind: 'saved', message: result.mode === 'remote' ? 'Page saved and published. Refresh its public URL to see the latest content.' : 'Saved locally without a Git commit.' });
    } catch (error) { setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Save failed.' }); }
  }

  async function submitNewPage(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); const slug = newSlug || slugFromTitle(newTitle); if (!slug) return;
    const firstBlock = catalog.blocks[0];
    const candidate: PageDocument = { id: `page-${crypto.randomUUID()}`, slug, status: 'published', title: newTitle.trim(), seo: { title: '', description: '' }, blocks: firstBlock ? [{ id: newId(firstBlock.type), type: firstBlock.type, status: 'active', content: structuredClone(firstBlock.defaults) }] : [] };
    setStatus({ kind: 'saving', message: 'Validating and creating page…' });
    try {
      const result = await createPage(candidate, collectionRevision, crypto.randomUUID());
      setCreating(false); setNewTitle(''); setNewSlug('');
      await refreshPages(result.data.slug);
      setStatus({ kind: 'saved', message: 'Page created and published. Add it to Navigation when it should appear in the menu.' });
    } catch (error) { setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Page creation failed.' }); }
  }

  async function toggleArchived() {
    if (!page) return;
    const archiving = page.status === 'published';
    if (archiving && !window.confirm(`Archive “${page.title}”? Its public URL will stop displaying the page. Remove any navigation links to it separately.`)) return;
    markPage({ ...page, status: archiving ? 'archived' : 'published' });
  }

  async function permanentlyDeletePage() {
    if (!page || page.status !== 'archived' || page.slug === 'home') return;
    setStatus({ kind: 'saving', message: 'Checking dependencies and permanently deleting page…' });
    try {
      await deletePage(page.slug, revision, deleteConfirmation);
      setDeleting(false); setDeleteConfirmation(''); setPage(null); setDirty(false);
      await refreshPages();
      setStatus({ kind: 'saved', message: `“${page.title}” was permanently deleted. Git history remains the emergency recovery path.` });
    } catch (error) { setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Permanent deletion failed.' }); }
  }

  function chooseSection(next: Section) {
    if (dirty && next !== 'pages' && !window.confirm('Discard the unsaved page changes?')) return;
    if (next !== 'pages') setDirty(false); setSection(next);
  }

  const globalDefinition = catalog.globals.find((item) => item.key === section);
  return <div className="admin-shell">
    <header className="admin-header"><div><a className="admin-brand" href="/">Astro CMS</a><p>{mode === 'remote' ? 'Remote content workspace' : 'Local content workspace'}</p></div><div className="admin-header__actions"><a className="button button--secondary" href={page?.slug === 'home' ? '/' : `/${page?.slug ?? ''}`} target="_blank" rel="noreferrer">View page</a>{section === 'pages' && <button className="button button--primary" type="button" onClick={save} disabled={!dirty || status.kind === 'saving'}>{status.kind === 'saving' ? 'Working…' : mode === 'remote' ? 'Save page' : 'Save locally'}</button>}</div></header>
    <nav className="admin-sections" aria-label="Content areas"><button aria-current={section === 'pages' ? 'page' : undefined} onClick={() => chooseSection('pages')}>Pages</button>{catalog.globals.map((item) => <button key={item.key} aria-current={section === item.key ? 'page' : undefined} onClick={() => chooseSection(item.key)}>{item.title}</button>)}</nav>
    {globalDefinition ? <GlobalEditor definition={globalDefinition} /> : <>
      <div className="admin-status" data-kind={status.kind} role={status.kind === 'error' ? 'alert' : 'status'} aria-live="polite">{status.message}</div>
      <div className="page-manager">
        <aside className="page-list-panel" aria-labelledby="pages-heading"><div className="panel-heading"><div><p className="admin-kicker">Website</p><h1 id="pages-heading">Pages</h1></div><button className="button button--secondary" type="button" onClick={() => setCreating((value) => !value)}>{creating ? 'Cancel' : 'New page'}</button></div>
          {creating && <form className="new-page-form" onSubmit={submitNewPage}><label>Page title<input required maxLength={120} value={newTitle} onChange={(event) => { setNewTitle(event.target.value); if (!newSlug) setNewSlug(slugFromTitle(event.target.value)); }} /></label><label>URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={newSlug} onChange={(event) => setNewSlug(slugFromTitle(event.target.value))} /><small>{newSlug ? `Public URL: /${newSlug}` : 'Lowercase letters, numbers, and hyphens.'}</small></label><button className="button button--primary" type="submit" disabled={!newTitle.trim() || !newSlug}>Create and publish</button></form>}
          <ul className="page-list">{pages.map((item) => <li key={item.id}><button type="button" aria-current={page?.slug === item.slug ? 'page' : undefined} onClick={() => selectPage(item.slug)}><span><strong>{item.title}</strong><small>/{item.slug === 'home' ? '' : item.slug}</small></span><span className={`status-pill status-pill--${item.status}`}>{item.status}</span></button></li>)}</ul>
        </aside>
        {page ? <div className="page-editor-area"><section className="page-settings" aria-labelledby="page-settings-heading"><div className="admin-editor__heading"><div><p className="admin-kicker">Page details</p><h2 id="page-settings-heading">{page.title}</h2><p>The slug is permanent. Archive a page to remove it from the public site while retaining Git history.</p></div><button className={page.status === 'published' ? 'button danger-action' : 'button button--secondary'} type="button" disabled={page.slug === 'home'} onClick={toggleArchived}>{page.status === 'published' ? 'Archive page' : 'Restore page'}</button></div><div className="page-fields"><label>Title<input value={page.title} maxLength={120} onChange={(event) => markPage({ ...page, title: event.target.value })} /></label><label>URL slug<input value={page.slug} disabled aria-describedby="slug-help" /><small id="slug-help">Page slugs cannot be changed after creation.</small></label><label>SEO title<input value={page.seo.title} maxLength={120} onChange={(event) => markPage({ ...page, seo: { ...page.seo, title: event.target.value } })} /></label><label className="field-wide">SEO description<textarea value={page.seo.description} maxLength={200} onChange={(event) => markPage({ ...page, seo: { ...page.seo, description: event.target.value } })} /></label></div>{page.status === 'archived' && page.slug !== 'home' && <section className="delete-zone" aria-labelledby="delete-page-heading"><div><h3 id="delete-page-heading">Permanently delete page</h3><p>This removes the page and its validation record after dependency checks. The CMS cannot undo it; recovery requires Git history.</p></div>{!deleting ? <button className="button danger-action" type="button" onClick={() => setDeleting(true)}>Delete permanently…</button> : <div className="delete-confirmation"><label>Type <strong>{page.slug}</strong> or the exact page title to confirm<input autoFocus value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label><div className="editor-actions"><button className="button button--secondary" type="button" onClick={() => { setDeleting(false); setDeleteConfirmation(''); }}>Cancel</button><button className="button danger-action" type="button" disabled={deleteConfirmation.trim() !== page.slug && deleteConfirmation.trim() !== page.title} onClick={permanentlyDeletePage}>Delete page permanently</button></div></div>}</section>}</section>
          <div className="admin-workspace"><aside className="admin-sidebar" aria-labelledby="blocks-heading"><div className="admin-sidebar__heading"><div><p className="admin-kicker">Page content</p><h2 id="blocks-heading">Blocks</h2></div><label><span>Add block</span><select value="" onChange={(event) => { if (event.target.value) addBlock(event.target.value); }}><option value="">Choose…</option>{catalog.blocks.map((definition) => <option key={definition.type} value={definition.type}>{definition.editor.title}</option>)}</select></label></div><ol className="block-list">{page.blocks.map((block, index) => { const definition = catalog.blocks.find((item) => item.type === block.type); return <li key={block.id}><button type="button" className="block-list__item" aria-current={block.id === selectedId ? 'true' : undefined} onClick={() => setSelectedId(block.id)}><span>{index + 1}</span><span><strong>{definition?.editor.title ?? block.type}</strong><small>{block.status === 'hidden' ? 'Hidden · ' : ''}{definition?.editor.description}</small></span></button></li>; })}</ol></aside>
            <section className="admin-editor" aria-labelledby="editor-heading">{selectedBlock && selectedDefinition ? <><div className="admin-editor__heading"><div><p className="admin-kicker">Block {selectedIndex + 1}</p><h2 id="editor-heading">{selectedDefinition.editor.title}</h2><p>{selectedDefinition.editor.description}</p></div><div className="editor-actions" aria-label="Block actions"><button type="button" onClick={() => moveSelected(-1)} disabled={selectedIndex === 0}>Move up</button><button type="button" onClick={() => moveSelected(1)} disabled={selectedIndex === page.blocks.length - 1}>Move down</button><button type="button" onClick={toggleSelectedVisibility}>{selectedBlock.status === 'active' ? 'Hide' : 'Show'}</button><button type="button" onClick={duplicateSelected}>Duplicate</button><button className="danger-action" type="button" onClick={deleteSelected}>Delete</button></div></div><div className="reusable-controls">{selectedBlock.reusable ? <><div><strong>Linked to {reusableLibrary.blocks.find((entry) => entry.id === selectedBlock.reusable?.sourceId)?.name ?? selectedBlock.reusable.sourceId}</strong><p>Shared changes propagate here. {Object.keys(selectedBlock.reusable.overrides).length ? `Refined fields: ${Object.keys(selectedBlock.reusable.overrides).join(', ')}.` : 'This instance has no refinements.'}</p></div><button className="button button--secondary" type="button" onClick={detachReusable}>Detach copy</button></> : <label>Use reusable block<select value="" onChange={(event) => event.target.value && attachReusable(event.target.value)}><option value="">Standalone block</option>{reusableLibrary.blocks.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} — {entry.type}</option>)}</select></label>}</div><Form schema={selectedDefinition.schema} formData={resolveReusableBlock(selectedBlock, reusableLibrary).content} validator={validator} onChange={updateSelectedContent} liveValidate="onBlur" showErrorList={false} uiSchema={{ 'ui:submitButtonOptions': { norender: true } }} /></> : <div className="admin-empty"><h2 id="editor-heading">No block selected</h2><p>Add or select a block to edit its content.</p></div>}</section></div></div> : <div className="admin-empty"><h2>No page selected</h2><p>Create or select a page to continue.</p></div>}
      </div></>}
  </div>;
}
