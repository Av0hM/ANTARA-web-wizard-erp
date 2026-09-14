import { useEffect, useRef, useState } from 'react';
export type AlbumMedia = { id: string; kind: 'image' | 'video'; src: string; thumbnail: string; caption: string; alt: string };
export default function AlbumDialog({ slug, title, onClose }: { slug: string; title: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<AlbumMedia[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mediaError, setMediaError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/albums/${encodeURIComponent(slug)}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(response.status === 404 ? 'This album is no longer available.' : 'Could not open this album.');
      const data = await response.json();
      if (!controller.signal.aborted) { setItems(data.item.items); setIndex(0); }
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, retry]);
  const current = items[index];
  const go = (next: number) => { setIndex(next); setMediaError(false); };
  return <dialog ref={dialog} className="album-dialog" aria-labelledby="album-title" data-lenis-prevent onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => {
    if ((event.target as HTMLElement).tagName === 'VIDEO') return;
    if (event.key === 'ArrowRight' && items.length) { event.preventDefault(); go((index + 1) % items.length); }
    if (event.key === 'ArrowLeft' && items.length) { event.preventDefault(); go((index - 1 + items.length) % items.length); }
  }}>
    <div className="album-dialog__inner">
      <header><div><p className="panel-eyebrow">Mission archive</p><h2 id="album-title">{title}</h2></div><button autoFocus onClick={onClose} aria-label="Close album">Close ×</button></header>
      {loading ? <p role="status">Loading album…</p> : error ? <p role="alert">{error} <button onClick={() => { setLoading(true); setError(''); setRetry(value => value + 1); }}>Retry</button></p> : !current ? <p>Photos and videos will appear here soon.</p> : <>
        <div className="album-dialog__stage">
          {mediaError ? <p role="alert">This file could not be displayed. <a href={current.src} target="_blank" rel="noreferrer">Open original</a></p> : current.kind === 'video'
            ? <video key={current.id} src={current.src} controls playsInline preload="none" aria-label={current.alt || current.caption || title} onError={() => setMediaError(true)} />
            : <img key={current.id} src={current.src} alt={current.alt || current.caption || title} onError={() => setMediaError(true)} />}
        </div>
        <div className="album-dialog__navigation"><button disabled={index === 0} onClick={() => go(index - 1)}>← Previous</button><span aria-live="polite">{index + 1} / {items.length} · {current.kind === 'video' ? 'Video' : 'Photo'}</span><button disabled={index === items.length - 1} onClick={() => go(index + 1)}>Next →</button></div>
        {current.caption && <p className="album-caption">{current.caption}</p>}
        <nav className="album-dialog__index" aria-label="Choose a photo or video">{items.map((item, i) => <button key={item.id} aria-current={i === index ? 'true' : undefined} aria-label={`${item.kind === 'video' ? 'Video' : 'Photo'} ${i + 1}${item.caption ? `: ${item.caption}` : ''}`} onClick={() => go(i)}>{item.kind === 'video' ? '▷ ' : ''}{i + 1}</button>)}</nav>
      </>}
    </div>
  </dialog>;
}
