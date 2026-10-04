import { toBlob } from 'html-to-image';

const MIN_PIXEL_RATIO = 2;
const MAX_PIXEL_RATIO = 4;
// Small items (a lone KPI tile) are upscaled so they're still sharp when a feed shows them wide.
const MIN_OUTPUT_WIDTH = 1080;
const GOOGLE_FONTS_HOST = 'https://fonts.googleapis.com';
// Google splits each family into per-script @font-face blocks, labelled by a comment. The
// site is English-language with some accented names, so latin and latin-ext cover it; the
// rest would add hundreds of KB to every image.
const KEEP_SUBSETS = ['latin', 'latin-ext'];

function blobToDataUrl (blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function keepWantedSubsets (css) {
  const blocks = css.split(/(?=\/\*\s[\w-]+\s\*\/)/);
  // Sheets without subset comments (the icon font) are kept whole.
  if (blocks.length === 1) return css;
  return blocks.filter((b) => KEEP_SUBSETS.some((name) => b.startsWith(`/* ${name} */`))).join('\n');
}

async function inlineFontUrls (css) {
  const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
  // The icon font is served as text/html, which makes an unusable data URL, so set the type.
  const dataUrls = await Promise.all(urls.map(async (u) => {
    const bytes = await (await fetch(u)).blob();
    return blobToDataUrl(new Blob([bytes], { type: 'font/woff2' }));
  }));
  return urls.reduce((out, u, i) => out.split(u).join(dataUrls[i]), css);
}

// html-to-image can't read the cross-origin Google Fonts stylesheets (the browser blocks their
// cssRules), so without this the PNG falls back to system fonts and the icon glyphs go blank.
// Built once per page load; if it fails we export without it rather than not at all.
let fontCssPromise = null;
function getFontEmbedCss () {
  if (!fontCssPromise) {
    const links = [...document.querySelectorAll(`link[rel="stylesheet"][href^="${GOOGLE_FONTS_HOST}"]`)];
    fontCssPromise = Promise.all(links.map(async (l) => inlineFontUrls(keepWantedSubsets(await (await fetch(l.href)).text()))))
      .then((parts) => parts.join('\n'))
      .catch((err) => {
        console.error('Could not embed web fonts', err);
        fontCssPromise = null;
        return '';
      });
  }
  return fontCssPromise;
}

// Renders an export frame to a PNG blob. The frame's scaled-to-fit wrapper is its parent,
// so the frame itself is captured at its natural size; `transform: none` is belt and braces.
export async function frameToBlob (node) {
  if (document.fonts?.ready) await document.fonts.ready;
  const options = {
    fontEmbedCSS: await getFontEmbedCss(),
    pixelRatio: Math.min(MAX_PIXEL_RATIO, Math.max(MIN_PIXEL_RATIO, MIN_OUTPUT_WIDTH / node.offsetWidth)),
    backgroundColor: '#ffffff',
    style: { transform: 'none', margin: '0' },
  };
  const blob = await toBlob(node, options);
  if (!blob) throw new Error('Could not render image');
  return blob;
}

export function exportFilename (item, ratioId = 'fit') {
  const slug = [item.type, item.gameId, item.params?.label, ratioId === 'fit' ? null : ratioId]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `byu-hoops-${slug}.png`;
}

export function downloadBlob (blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canCopyImage () {
  return typeof ClipboardItem !== 'undefined' && Boolean(navigator.clipboard?.write);
}

export async function copyBlob (blob) {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

function asFile (blob, filename) {
  return new File([blob], filename, { type: 'image/png' });
}

// Mobile share sheet with the image attached; desktop browsers mostly don't support file shares.
export function canShareFilesAtAll () {
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });
}

export async function shareBlob (blob, filename, title) {
  await navigator.share({ files: [asFile(blob, filename)], title });
}
