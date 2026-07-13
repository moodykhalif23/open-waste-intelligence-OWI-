import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

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
    <Stack spacing={2}>
      {cameraFailed ? (
        <Typography variant="body2" color="text.secondary">
          {labels.cameraDenied}
        </Typography>
      ) : (
        <Box
          component="video"
          ref={videoRef}
          muted
          playsInline
          sx={{ width: "100%", borderRadius: "4px", bgcolor: "#000", aspectRatio: "3 / 4", objectFit: "cover" }}
        />
      )}
      <TextField
        size="small"
        fullWidth
        label={labels.manual}
        value={manualCode}
        onChange={(e) => setManualCode(e.target.value)}
        slotProps={{ htmlInput: { autoCapitalize: "none", autoCorrect: "off" } }}
      />
      <Stack direction="row" spacing={1.5}>
        <Button variant="outlined" sx={{ flex: 1 }} onClick={onCancel}>
          {labels.cancel}
        </Button>
        <Button
          variant="contained"
          sx={{ flex: 2 }}
          disabled={!manualCode.trim()}
          onClick={() => onResult(manualCode.trim())}
        >
          {labels.ok}
        </Button>
      </Stack>
    </Stack>
  );
}
