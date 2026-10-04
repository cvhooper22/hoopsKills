import React, { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import FitToWidth from './FitToWidth';
import {
  canCopyImage, canShareFilesAtAll, copyBlob, downloadBlob, exportFilename, frameToBlob, shareBlob,
} from '../../utils/exportImage';
import { EXPORT_RATIOS, DEFAULT_RATIO_ID } from '../../constants/exportRatios';
import { stageSize } from '../../utils/exportStage';
import './ExportCard.css';

const DEFAULT_WIDTH = 960;

// The shareable picture of one collected item: a fixed-width frame (so every export has the
// same layout regardless of the viewer's screen) with the game as a caption and the site as
// a footer, plus the buttons that turn it into a PNG. Everything inside `.export-frame` is
// what ends up in the image.
const ExportCard = forwardRef(function ExportCard ({ item, width = DEFAULT_WIDTH, ratioId = DEFAULT_RATIO_ID, children, onRemove }, ref) {
  const frameRef = useRef(null);
  const stageRef = useRef(null);
  const [frameHeight, setFrameHeight] = useState(0);
  const ratio = EXPORT_RATIOS.find((r) => r.id === ratioId)?.ratio ?? null;
  const stage = stageSize(width, frameHeight, ratio);
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');

  // The stage depends on how tall the content is, which isn't known until it's laid out.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const update = () => setFrameHeight(frame.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Lets the page export every card ("Download all") without duplicating the render logic.
  useImperativeHandle(ref, () => ({
    getBlob: () => frameToBlob(stageRef.current),
    filename: () => exportFilename(item, ratioId),
  }), [item, ratioId]);

  async function run (kind, action) {
    setBusy(kind);
    setStatus('');
    try {
      const blob = await frameToBlob(stageRef.current);
      await action(blob, exportFilename(item, ratioId));
    } catch (err) {
      // A cancelled share sheet isn't a failure.
      if (err?.name !== 'AbortError') {
        console.error(err);
        setStatus('Could not create the image');
      }
    } finally {
      setBusy('');
    }
  }

  const download = () => run('download', (blob, name) => downloadBlob(blob, name));
  const copy = () => run('copy', async (blob) => {
    await copyBlob(blob);
    setStatus('Copied');
  });
  const share = () => run('share', (blob, name) => shareBlob(blob, name, item.title));

  return (
    <div className="export-card">
      <div className="export-card__head">
        <div className="export-card__text">
          <span className="export-card__title">{item.title}</span>
          {item.subtitle && <span className="export-card__subtitle">{item.subtitle}</span>}
        </div>
        <div className="export-card__actions">
          {status && <span className="export-card__status" role="status">{status}</span>}
          {canShareFilesAtAll() && (
            <button type="button" className="export-card__btn" onClick={share} disabled={Boolean(busy)}>
              {busy === 'share' ? 'Preparing…' : 'Share'}
            </button>
          )}
          {canCopyImage() && (
            <button type="button" className="export-card__btn" onClick={copy} disabled={Boolean(busy)}>
              {busy === 'copy' ? 'Copying…' : 'Copy'}
            </button>
          )}
          <button type="button" className="export-card__btn export-card__btn--primary" onClick={download} disabled={Boolean(busy)}>
            {busy === 'download' ? 'Preparing…' : 'Download PNG'}
          </button>
          <button type="button" className="export-card__btn" onClick={onRemove} aria-label={`Remove ${item.title}`}>
            Remove
          </button>
        </div>
      </div>
      <FitToWidth width={stage.width}>
        <div
          className="export-stage"
          ref={stageRef}
          style={{ width: stage.width, height: ratio ? stage.height : undefined }}
        >
          <div className="export-frame" ref={frameRef} style={{ width }}>
            {item.subtitle && <div className="export-frame__caption">{item.subtitle}</div>}
            <div className="export-frame__body">{children}</div>
            <div className="export-frame__footer">
              <span className="export-frame__brand">BYU Hoops Stats</span>
              <span>{window.location.host}</span>
            </div>
          </div>
        </div>
      </FitToWidth>
    </div>
  );
});

export default ExportCard;
