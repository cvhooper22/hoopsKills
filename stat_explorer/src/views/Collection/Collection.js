import React, { useRef, useState } from 'react';
import "./Collection.css";
import { useCollection } from '../../contexts/CollectionContext';
import { exportWidthFor, renderItem } from '../../collection/registry';
import ExportCard from '../../components/ExportCard/ExportCard';
import RenderBoundary from '../../components/Collectable/RenderBoundary';
import { downloadBlob } from '../../utils/exportImage';
import { EXPORT_RATIOS, DEFAULT_RATIO_ID, RATIO_STORAGE_KEY } from '../../constants/exportRatios';
import { getStorageItem, setStorageItem } from '../../utils/localStorage';

const DOWNLOAD_GAP_MS = 400;

function initialRatioId () {
  const saved = getStorageItem(RATIO_STORAGE_KEY);
  return EXPORT_RATIOS.some((r) => r.id === saved) ? saved : DEFAULT_RATIO_ID;
}

function Unavailable ({ item, onRemove }) {
  return (
    <div className="collection__unavailable">
      <span>"{item.title}" can't be shown anymore.</span>
      <button type="button" className="collection__btn" onClick={onRemove}>Remove</button>
    </div>
  );
}

export default function Collection () {
  const { items, count, remove, clear } = useCollection();
  const cardRefs = useRef(new Map());
  const [bulk, setBulk] = useState('');
  const [ratioId, setRatioId] = useState(initialRatioId);

  function chooseRatio (id) {
    setRatioId(id);
    setStorageItem(RATIO_STORAGE_KEY, id);
  }

  // One at a time, with a gap, so the browser doesn't drop or prompt over a burst of downloads.
  async function downloadAll () {
    setBulk('Preparing…');
    try {
      for (const item of items) {
        const card = cardRefs.current.get(item.id);
        if (card) {
          downloadBlob(await card.getBlob(), card.filename());
          await new Promise((r) => setTimeout(r, DOWNLOAD_GAP_MS));
        }
      }
      setBulk('');
    } catch (err) {
      console.error(err);
      setBulk('Some images could not be created');
    }
  }

  return (
    <div className="collection scroll">
      <header className="collection__header">
        <h2 className="collection__title">Your collection</h2>
        {count > 0 && (
          <div className="collection__header-actions">
            {bulk && <span className="collection__status" role="status">{bulk}</span>}
            <button type="button" className="collection__btn" onClick={downloadAll} disabled={bulk === 'Preparing…'}>
              Download all
            </button>
            <button type="button" className="collection__btn" onClick={clear}>Clear all</button>
          </div>
        )}
      </header>
      {count > 0 && (
        <div className="collection__ratios" role="radiogroup" aria-label="Image shape">
          <span className="collection__ratios-label">Shape</span>
          {EXPORT_RATIOS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={r.id === ratioId}
              className={`collection__chip${r.id === ratioId ? ' collection__chip--active' : ''}`}
              onClick={() => chooseRatio(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      {count === 0 ? (
        <p className="collection__empty">
          Nothing collected yet. Tables and stats you add from the other pages will show up here.
        </p>
      ) : (
        <ul className="collection__list">
          {items.map((item) => {
            const content = renderItem(item);
            const onRemove = () => remove(item.id);
            return (
              <li key={item.id}>
                {content === null ? <Unavailable item={item} onRemove={onRemove} /> : (
                  <RenderBoundary fallback={<Unavailable item={item} onRemove={onRemove} />}>
                    <ExportCard
                      ref={(el) => (el ? cardRefs.current.set(item.id, el) : cardRefs.current.delete(item.id))}
                      item={item}
                      width={exportWidthFor(item)}
                      ratioId={ratioId}
                      onRemove={onRemove}
                    >
                      {content}
                    </ExportCard>
                  </RenderBoundary>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
