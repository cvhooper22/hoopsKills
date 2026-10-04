// Size of the canvas an item is exported on. The content frame keeps its fixed width and is
// centered; the canvas grows past it in whichever direction is needed to reach the ratio,
// so content is never cropped or scaled.
export function stageSize (frameWidth, frameHeight, ratio) {
  if (!ratio) return { width: frameWidth, height: frameHeight };
  const width = Math.ceil(Math.max(frameWidth, frameHeight * ratio));
  return { width, height: Math.ceil(width / ratio) };
}
