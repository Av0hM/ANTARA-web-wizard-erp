import { useEffect, useRef, useState } from 'react';
import type { AlbumMedia } from './AlbumDialog';
export type MediaDraft = { items: AlbumMedia[]; revision: number; dirty: boolean };
type Props = { disabled: boolean; slug: string; token: string; draft?: MediaDraft; onDraft: (value: MediaDraft) => void; onBusy: (busy: boolean) => void; onCover: (url: string) => void; onExpired: () => void };
export function AdminAlbumMedia({ disabled, slug, token, draft, onDraft, onBusy, onCover, onExpired }: Props) {
  const [items, setItems] = useState<AlbumMedia[]>(draft?.items || []);
  const [revision, setRevision] = useState(draft?.revision || 0);
  const [dirty, setDirty] = useState(draft?.dirty || false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [limits, setLimits] = useState({ imageMaxMB: 5, videoMaxMB: 100 });
  const [progress, setProgress] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  const mounted = useRef(true);
  const onDraftRef = useRef(onDraft); onDraftRef.current = onDraft;
  const onBusyRef = useRef(onBusy); onBusyRef.current = onBusy;
  const onExpiredRef = useRef(onExpired); onExpiredRef.current = onExpired;
  const preservedDraft = useRef(draft);
  useEffect(() => { onDraftRef.current({ items, revision, dirty }); }, [items, revision, dirty]);
  useEffect(() => { onBusyRef.current(busy); }, [busy]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); onBusyRef.current(false); }; }, []);
  const headers = { Authorization: `Bearer ${token}` };
  const read = async (response: Response) => {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { onExpiredRef.current(); throw new Error('Session expired. Sign in again; unsaved captions are retained.'); }
    if (!response.ok) throw new Error(data.error || 'The operation failed. Try again.');
    return data;
  };
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/albums/${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (response.status === 401) onExpiredRef.current();
        if (!response.ok) throw new Error(data.error || 'Could not load album media.');
        if (controller.signal.aborted) return;
        if (!preservedDraft.current?.dirty) { setItems(data.item.items); setRevision(data.item.revision); }
        setLimits(data.limits);
      }).catch(error => { if (!controller.signal.aborted) setStatus(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, token]);
  const reload = async () => {
    const data = await read(await fetch(`/api/admin/albums/${encodeURIComponent(slug)}`, { headers }));
    if (!mounted.current) return;
    setItems(data.item.items); setRevision(data.item.revision); setDirty(false); setLimits(data.limits);
  };
  const upload = async (files: File[]) => {
    if (!files.length || busy || disabled) return;
    if (dirty) { setStatus('Save captions and ordering before uploading files.'); return; }
    setBusy(true); setProgress(0);
    const failures: string[] = [];
    let successes = 0;
    for (const [index, file] of files.entries()) {
      if (!mounted.current) break;
      const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
      if ((!isImage && !['video/mp4', 'video/webm'].includes(file.type)) || file.size > (isImage ? limits.imageMaxMB : limits.videoMaxMB) * 1024 * 1024) {
        failures.push(`${file.name}: unsupported type or too large`); continue;
      }
      setStatus(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest(); request.current = xhr;
          xhr.open('POST', `/api/admin/albums/${encodeURIComponent(slug)}/media`);
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.timeout = 10 * 60 * 1000;
          xhr.upload.onprogress = event => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
          xhr.onerror = () => reject(new Error('Network error'));
          xhr.onabort = () => reject(new Error('Upload cancelled'));
          xhr.ontimeout = () => reject(new Error('Upload timed out'));
          xhr.onload = () => {
            let data: { error?: string } = {};
            try { data = JSON.parse(xhr.responseText); } catch { /* Handle non-JSON proxy errors. */ }
            if (xhr.status === 401) { onExpiredRef.current(); reject(new Error('Session expired')); }
            else if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(data.error || `Upload failed (${xhr.status})`));
          };
          const payload = new FormData(); payload.set('media', file); xhr.send(payload);
        });
        successes++;
      } catch (error) { failures.push(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed'}`); if (!mounted.current || String(error).includes('Session expired')) break; }
    }
    if (!mounted.current) return;
    try { await reload(); } catch (error) { failures.push(String(error)); }
    setStatus(`${successes} file(s) uploaded.${failures.length ? ` Please retry: ${failures.join('; ')}` : ''}`);
    setBusy(false); setProgress(0);
    if (fileInput.current) fileInput.current.value = '';
  };
  const save = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await read(await fetch(`/api/admin/albums/${encodeURIComponent(slug)}/media`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: revision, items: items.filter(item => item.id !== 'legacy') }) }));
      await reload(); setStatus('Captions and ordering saved.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Save failed.'); }
    finally { setBusy(false); }
  };
  const remove = async (item: AlbumMedia) => {
    if (busy || disabled || dirty) { setStatus('Save captions and ordering before removing a file.'); return; }
    if (!window.confirm(`Permanently delete this ${item.kind === 'image' ? 'photo' : 'video'} from the album and storage?`)) return;
    setBusy(true);
    try { await read(await fetch(`/api/admin/albums/${encodeURIComponent(slug)}/media/${item.id}`, { method: 'DELETE', headers: { ...headers, 'If-Match': String(revision) } })); await reload(); setStatus('Media deleted.'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Delete failed.'); }
    finally { setBusy(false); }
  };
  const move = (index: number, direction: number) => {
    const next = [...items]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setItems(next); setDirty(true);
  };
  return <section className="admin-album-media" aria-labelledby="album-media-heading">
    <h3 id="album-media-heading">Album photos & videos</h3>
    <p>JPEG, PNG, WebP up to {limits.imageMaxMB} MB. MP4/WebM up to {limits.videoMaxMB} MB each. Uploads save immediately; captions and ordering save separately.</p>
    <fieldset disabled={disabled || busy || loading}>
      <label>Add files<input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={dirty} onChange={event => void upload(Array.from(event.target.files || []))} /></label>
      <div className="admin-post-form__actions"><button type="button" disabled={!dirty} onClick={save}>Save captions & order</button><button type="button" onClick={() => {
        if (dirty && !window.confirm('Discard unsaved captions and ordering?')) return;
        setBusy(true); reload().then(() => setStatus('Media refreshed.')).catch(error => setStatus(error.message)).finally(() => setBusy(false));
      }}>Reload media</button></div>
      {items.map((item, index) => <article className="admin-media-item" key={item.id}>
        <div className="admin-media-item__preview">{item.kind === 'image' && item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" /> : <span>{item.kind === 'video' ? '▷ Video' : 'Photo'}</span>}</div>
        {item.id === 'legacy' ? <p>Original album attachment. Use “Remove existing attachment” in the entry form to delete it.</p> : <>
          <label>Caption<textarea value={item.caption} maxLength={2000} onChange={event => { setItems(previous => previous.map(row => row.id === item.id ? { ...row, caption: event.target.value } : row)); setDirty(true); }} /></label>
          <label>{item.kind === 'image' ? 'Image description (alt text)' : 'Video description'}<input value={item.alt} maxLength={500} onChange={event => { setItems(previous => previous.map(row => row.id === item.id ? { ...row, alt: event.target.value } : row)); setDirty(true); }} /></label>
          <div className="admin-post-form__actions">
            <button type="button" disabled={index === 0 || items[index - 1]?.id === 'legacy'} aria-label={`Move item ${index + 1} up`} onClick={() => move(index, -1)}>↑</button>
            <button type="button" disabled={index === items.length - 1} aria-label={`Move item ${index + 1} down`} onClick={() => move(index, 1)}>↓</button>
            {item.thumbnail && <button type="button" onClick={() => { onCover(item.thumbnail); setStatus('Cover selected. Save the entry to apply it.'); }}>Use as cover</button>}
            <button type="button" className="admin-danger" disabled={dirty} onClick={() => void remove(item)}>Delete file</button>
          </div>
        </>}
      </article>)}
    </fieldset>
    {loading && <p role="status">Loading media…</p>}
    {!loading && !items.length && <p>No files yet. Add photos or videos above.</p>}
    {busy && progress > 0 && <progress value={progress} max="100" aria-label="File upload progress" />}
    <p role="status" className="admin-notice">{status}</p>
  </section>;
}
