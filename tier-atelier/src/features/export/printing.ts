import { e } from '../../app/exportMessages';
import { printSlices } from './layout';
import { encodeCanvas, type RenderedImage } from './render';

export interface PrintDocument { frame: HTMLIFrameElement; pages: number; print: () => void; dispose: () => void }
export async function preparePrint(image: RenderedImage, title: string, signal?: AbortSignal): Promise<PrintDocument> {
  const frame = document.createElement('iframe'); frame.title = e.printFrame; frame.className = 'export-print-frame'; frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
  const urls: string[] = [];
  const dispose = () => { frame.remove(); urls.forEach((url) => URL.revokeObjectURL(url)); };
  try {
    document.body.append(frame);
    const doc = frame.contentDocument;
    if (!doc || !frame.contentWindow) throw new Error(e.printError);
    doc.title = title;
    doc.documentElement.lang = 'ja';
    const style = doc.createElement('style');
    style.textContent = '@page { size: A4 portrait; margin: 12mm; } html,body { margin:0; padding:0; } img { display:block; width:100%; height:auto; break-after:page; page-break-after:always; } img:last-child { break-after:auto; page-break-after:auto; }';
    doc.head.append(style);
    const slices = printSlices(image.width, image.height, image.layout.breaks.map((y) => y * image.options.scale));
    for (const slice of slices) {
      signal?.throwIfAborted();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = slice.height;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error(e.printError);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image.canvas, 0, slice.y, image.width, slice.height, 0, 0, image.width, slice.height);
      const blob = await encodeCanvas(canvas, 'png'); canvas.width = canvas.height = 1;
      const url = URL.createObjectURL(blob); urls.push(url);
      const img = doc.createElement('img'); img.src = url; img.alt = title; doc.body.append(img); await img.decode();
    }
    signal?.throwIfAborted();
    return { frame, pages: slices.length, dispose, print: () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); } };
  } catch (error) { dispose(); throw error; }
}
