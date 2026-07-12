import { useEffect, useRef, useState } from "react";

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

interface Props {
  onResult: (code: string) => void;
  onCancel: () => void;
  labels: { manual: string; cancel: string; ok: string; cameraDenied: string };
}

export default function QrScan({ onResult, onCancel, labels }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraFailed, setCameraFailed] = useState(!window.BarcodeDetector);
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    if (cameraFailed) return;
    const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let done = false;

    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        void video.play();
        timer = window.setInterval(() => {
          if (done || video.readyState < 2) return;
          void detector.detect(video).then((codes) => {
            const code = codes[0]?.rawValue;
            if (code && !done) {
              done = true;
              onResult(code);
            }
          });
        }, 400);
      })
      .catch(() => setCameraFailed(true));

    return () => {
      done = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraFailed, onResult]);

  return (
    <div className="scanner">
      {cameraFailed ? (
        <p className="gps">{labels.cameraDenied}</p>
      ) : (
        <video ref={videoRef} className="scanner-video" muted playsInline />
      )}
      <label className="manual">
        {labels.manual}
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </label>
      <div className="actions">
        <button className="secondary" onClick={onCancel}>
          {labels.cancel}
        </button>
        <button
          className="primary"
          disabled={!manualCode.trim()}
          onClick={() => onResult(manualCode.trim())}
        >
          {labels.ok}
        </button>
      </div>
    </div>
  );
}
