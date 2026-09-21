import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Renders `value` as a QR code image. Kept large enough for reliable camera
 * scanning (§53). Generation is done in the browser by the `qrcode` library.
 */
const QrImage = ({ value, size = 240, className = '' }) => {
  const [dataUrl, setDataUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setDataUrl('');
    if (!value) return undefined;
    QRCode.toDataURL(String(value), {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: size * 2, // render at 2x for crisp display / print
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500 ${className}`}
        style={{ width: size, height: size }}
      >
        Could not render the QR code.
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className={`animate-pulse rounded-lg border border-slate-200 bg-slate-100 ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Attendance QR code"
      width={size}
      height={size}
      className={`rounded-lg border border-slate-200 bg-white ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

export default QrImage;
