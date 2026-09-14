import { lazy, Suspense, useEffect, useState } from 'react';
const AlbumDialog = lazy(() => import('./AlbumDialog'));
type Album = { slug: string; title: string; excerpt: string; coverImage: string; mediaCount: number };

export function Gallery() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Album | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/albums?page=${page}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Could not load albums. Please try again.');
      const data = await response.json();
      if (controller.signal.aborted) return;
      setAlbums(previous => page === 1 ? data.items : [...previous.filter(item => !data.items.some((next: Album) => next.slug === item.slug)), ...data.items]);
      setHasMore(data.hasMore);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, retry]);
  return <>
    <div className="gallery-section__intro" id="gallery">
      <p className="mission-copy__eyebrow">Gallery</p><h2>Inside the mission.</h2>
      <p className="content-copy">Explore the builds, the tests, and the people behind Antara.</p>
    </div>
    <div className="gallery-grid" aria-busy={loading}>
      {albums.map(album => <button key={album.slug} className="gallery-card gallery-card__open" onClick={() => setSelected(album)}>
        <div className="gallery-card__media">{album.coverImage ? <img src={album.coverImage} alt="" loading="lazy" decoding="async" /> : <span className="album-placeholder" aria-hidden="true">ANTARA / ARCHIVE</span>}</div>
        <div className="gallery-card__body"><p>{album.title}</p><span>{album.excerpt}</span><small>{album.mediaCount} {album.mediaCount === 1 ? 'item' : 'items'} · Open album ↗</small></div>
      </button>)}
    </div>
    {loading && <p role="status" className="content-copy">Loading albums…</p>}
    {error && <p role="alert" className="content-copy">{error} <button onClick={() => { setLoading(true); setError(''); setRetry(value => value + 1); }}>Retry</button></p>}
    {!loading && !error && !albums.length && <p className="content-copy">The first albums are on their way.</p>}
    {hasMore && !loading && !error && <button className="album-more" onClick={() => { setLoading(true); setError(''); setPage(value => value + 1); }}>More albums</button>}
    {selected && <Suspense fallback={<p role="status">Opening album…</p>}><AlbumDialog slug={selected.slug} title={selected.title} onClose={() => setSelected(null)} /></Suspense>}
  </>;
}
