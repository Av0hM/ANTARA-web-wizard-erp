import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorkerUrl from "antara-pdf-worker?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export default function DocumentReader({
  title,
  pdfUrl,
  onClose,
  pageLabel,
}: {
  title: string;
  pdfUrl: string;
  onClose: () => void;
  pageLabel?: string;
}) {
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(320);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(() => {
      setPageWidth(Math.max(1, Math.min(800, frame.clientWidth - 24)));
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const onDocumentLoadSuccess = ({ numPages: pageCount }: { numPages: number }) => {
    setNumPages(pageCount);
    setPdfError(null);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && (numPages === null || newPage <= numPages)) {
      setPage(newPage);
    }
  };

  return (
    <section className="document-reader" role="dialog" aria-modal="true">
      <button
        type="button"
        className="document-reader__backdrop"
        aria-label="Close document reader"
        onClick={onClose}
      />
      <div className="document-reader__shell">
        <div className="document-reader__head">
          <div>
            <p className="panel-eyebrow">Newsletter Archive</p>
            <h3>{title}</h3>
            <p className="content-copy">
              {pageLabel || "Read the full PDF in the embedded document viewer."}
            </p>
          </div>
          <button
            type="button"
            className="document-reader__close"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="document-reader__toolbar" aria-label="Document controls">
          <button type="button" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
            Previous Page
          </button>
          <button type="button" onClick={() => handlePageChange(page + 1)} disabled={numPages === null || page >= numPages}>
            Next Page
          </button>
          <button type="button" onClick={() => setPage(1)}>
            Reset
          </button>
          <a href={pdfUrl} target="_blank" rel="noreferrer">
            Open PDF
          </a>
          <a href={pdfUrl} download>
            Download
          </a>
          <span>Page {page}{numPages ? ` / ${numPages}` : ''}</span>
        </div>
        <div className="document-reader__frame" ref={frameRef}>
          {pdfError ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'white',
              padding: '2rem',
              textAlign: 'center',
            }}>
              <p>{pdfError}</p>
              <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', marginTop: '1rem', display: 'inline-block' }}>
                Open PDF directly
              </a>
            </div>
          ) : (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={(error) => {
                console.error('[DocumentReader] PDF load error:', error);
                setPdfError('Failed to load PDF. Please try opening it directly.');
              }}
              loading={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-tertiary)' }}>Loading PDF...</div>}
              error={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white', padding: '2rem', textAlign: 'center' }}>Failed to load PDF</div>}
            >
              <Page
                pageNumber={page}
                width={pageWidth}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          )}
        </div>
      </div>
    </section>
  );
}

