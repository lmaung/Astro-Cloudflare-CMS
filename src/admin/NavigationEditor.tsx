import { useEffect, useState } from 'react';
import type { Navigation } from '../domain/globals';
import { loadGlobal, loadPages, saveGlobal } from './local-gateway';

type Notice = { kind: 'ready' | 'saving' | 'saved' | 'error'; message: string };

export function NavigationEditor({ title, description }: { title: string; description: string }) {
  const [navigation, setNavigation] = useState<Navigation>();
  const [revision, setRevision] = useState('');
  const [pageRoutes, setPageRoutes] = useState<Array<{ label: string; href: string }>>([]);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<Notice>({ kind: 'ready', message: 'Loading navigation…' });

  useEffect(() => {
    let active = true;
    Promise.all([loadGlobal('navigation'), loadPages()]).then(([result, pages]) => {
      if (!active) return;
      setNavigation(result.data as Navigation); setRevision(result.revision);
      setPageRoutes(pages.data.filter((page) => page.status === 'published').map((page) => ({ label: page.title, href: page.slug === 'home' ? '/' : `/${page.slug}` })));
      setNotice({ kind: 'ready', message: 'Published navigation loaded.' });
    }).catch((reason: Error) => { if (active) setNotice({ kind: 'error', message: reason.message }); });
    return () => { active = false; };
  }, []);

  function update(next: Navigation) { setNavigation(next); setDirty(true); setNotice({ kind: 'ready', message: 'Unpublished navigation changes.' }); }
  function updateItem(index: number, field: 'label' | 'href', value: string) {
    if (!navigation) return; const primary = [...navigation.primary]; const item = primary[index]; if (!item) return;
    primary[index] = { ...item, [field]: value }; update({ primary });
  }
  function addItem() {
    if (!navigation) return;
    const available = pageRoutes.find((page) => !navigation.primary.some((item) => item.href === page.href));
    update({ primary: [...navigation.primary, available ?? { label: 'New link', href: '/' }] });
  }
  function move(index: number, offset: number) {
    if (!navigation) return; const destination = index + offset; if (destination < 0 || destination >= navigation.primary.length) return;
    const primary = [...navigation.primary]; const [item] = primary.splice(index, 1); if (!item) return; primary.splice(destination, 0, item); update({ primary });
  }
  function remove(index: number) {
    if (!navigation || !window.confirm(`Remove “${navigation.primary[index]?.label ?? 'this link'}” from navigation?`)) return;
    update({ primary: navigation.primary.filter((_, itemIndex) => itemIndex !== index) });
  }
  async function save() {
    if (!navigation || !dirty) return; setNotice({ kind: 'saving', message: 'Validating and saving navigation…' });
    try {
      const result = await saveGlobal('navigation', navigation, revision, crypto.randomUUID());
      setNavigation(result.data as Navigation); setRevision(result.revision); setDirty(false);
      setNotice({ kind: 'saved', message: result.mode === 'remote' ? 'Navigation saved. Refresh the website to see the new menu order.' : 'Navigation saved locally.' });
    } catch (reason) { setNotice({ kind: 'error', message: reason instanceof Error ? reason.message : 'Navigation save failed.' }); }
  }

  return <section className="admin-editor" aria-labelledby="navigation-heading">
    <div className="admin-editor__heading"><div><p className="admin-kicker">Global content</p><h1 id="navigation-heading">{title}</h1><p>{description} Menu order follows the order below.</p></div><button className="button button--primary" type="button" disabled={!dirty || notice.kind === 'saving'} onClick={save}>{notice.kind === 'saving' ? 'Working…' : 'Save navigation'}</button></div>
    <div className="admin-status" data-kind={notice.kind} role={notice.kind === 'error' ? 'alert' : 'status'} aria-live="polite">{notice.message}</div>
    {navigation && <div className="navigation-editor"><datalist id="published-page-routes">{pageRoutes.map((page) => <option key={page.href} value={page.href}>{page.label}</option>)}</datalist>
      <ol className="navigation-list">{navigation.primary.map((item, index) => <li key={`${index}-${item.href}`}><fieldset><legend>Menu item {index + 1}</legend><div className="navigation-fields"><label>Label<input value={item.label} maxLength={40} onChange={(event) => updateItem(index, 'label', event.target.value)} /></label><label>Page or safe URL<input list="published-page-routes" value={item.href} onChange={(event) => updateItem(index, 'href', event.target.value)} /><small>Choose a published page, an anchor beginning with #, or an HTTPS URL.</small></label></div><div className="editor-actions" aria-label={`Actions for ${item.label}`}><button type="button" onClick={() => move(index, -1)} disabled={index === 0}>Move up</button><button type="button" onClick={() => move(index, 1)} disabled={index === navigation.primary.length - 1}>Move down</button><button className="danger-action" type="button" onClick={() => remove(index)}>Remove</button></div></fieldset></li>)}</ol>
      <button className="button button--secondary" type="button" onClick={addItem} disabled={navigation.primary.length >= 20}>Add menu item</button>
    </div>}
  </section>;
}
