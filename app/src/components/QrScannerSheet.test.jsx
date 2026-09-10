import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import QrScannerSheet from './QrScannerSheet';

vi.mock('jsqr', () => ({ default: vi.fn() }));
import jsQR from 'jsqr';

const ORIGIN = 'http://localhost:3000';
const GOOD = `${ORIGIN}/scan/sponsor-1?c=abc123`;

function stubCanvas() {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  }));
}

function stubNoCamera() {
  Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
}

function stubLiveCamera() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    configurable: true,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { value: vi.fn().mockResolvedValue(), configurable: true });
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { get: () => 4, configurable: true });
  // videoWidth/Height are defined on HTMLVideoElement, which would shadow a stub on the parent
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { get: () => 640, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { get: () => 480, configurable: true });
  return { track };
}

beforeEach(() => {
  vi.clearAllMocks();
  stubCanvas();
  window.history.replaceState({}, '', `${ORIGIN}/`);
});
afterEach(() => vi.useRealTimers());

describe('QrScannerSheet', () => {
  it('falls back to photo mode when no camera API is available', async () => {
    stubNoCamera();
    render(<QrScannerSheet onScan={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Take a Photo')).toBeInTheDocument());
  });

  it('decodes a photo and calls onScan with the in-app path for one of our codes', async () => {
    stubNoCamera();
    globalThis.createImageBitmap = vi.fn().mockResolvedValue({ width: 800, height: 600 });
    jsQR.mockReturnValue({ data: GOOD });
    const onScan = vi.fn();
    render(<QrScannerSheet onScan={onScan} onClose={vi.fn()} />);
    await screen.findByText('Take a Photo');

    const input = screen.getByTestId('qr-file-input');
    const file = new File(['x'], 'qr.png', { type: 'image/png' });
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });

    await waitFor(() => expect(onScan).toHaveBeenCalledWith('/scan/sponsor-1?c=abc123'));
  });

  it('rejects a foreign QR (does not call onScan) and shows a hint', async () => {
    stubNoCamera();
    globalThis.createImageBitmap = vi.fn().mockResolvedValue({ width: 800, height: 600 });
    jsQR.mockReturnValue({ data: 'https://www.linkedin.com/in/someone' });
    const onScan = vi.fn();
    render(<QrScannerSheet onScan={onScan} onClose={vi.fn()} />);
    await screen.findByText('Take a Photo');

    const file = new File(['x'], 'qr.png', { type: 'image/png' });
    await act(async () => { fireEvent.change(screen.getByTestId('qr-file-input'), { target: { files: [file] } }); });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/not a passport code/i));
    expect(onScan).not.toHaveBeenCalled();
  });

  it('opens the live camera, decodes a frame, stops the stream and calls onScan', async () => {
    const { track } = stubLiveCamera();
    jsQR.mockReturnValue({ data: GOOD });
    const onScan = vi.fn();
    render(<QrScannerSheet onScan={onScan} onClose={vi.fn()} />);

    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    await waitFor(() => expect(onScan).toHaveBeenCalledWith('/scan/sponsor-1?c=abc123'), { timeout: 2000 });
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalled();
  });

  it('close button calls onClose', async () => {
    stubNoCamera();
    const onClose = vi.fn();
    render(<QrScannerSheet onScan={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close scanner'));
    expect(onClose).toHaveBeenCalled();
  });
});
