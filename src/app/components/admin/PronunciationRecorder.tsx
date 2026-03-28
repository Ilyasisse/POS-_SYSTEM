"use client";

import { useEffect, useRef, useState } from "react";

type PronunciationRecorderProps = {
  inputName: string;
  entityType: "product" | "modifier";
  label: string;
  currentUrl?: string | null;
};

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export default function PronunciationRecorder({
  inputName,
  entityType,
  label,
  currentUrl,
}: PronunciationRecorderProps) {
  const [audioUrl, setAudioUrl] = useState(currentUrl ?? "");
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setAudioUrl(currentUrl ?? "");
  }, [currentUrl]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function uploadRecording(blob: Blob) {
    const formData = new FormData();
    const extension = blob.type.includes("ogg")
      ? "ogg"
      : blob.type.includes("mp4")
        ? "m4a"
        : blob.type.includes("mpeg")
          ? "mp3"
          : "webm";

    formData.append(
      "file",
      new File([blob], `${label.toLowerCase().replace(/\s+/g, "-")}.${extension}`, {
        type: blob.type || "audio/webm",
      }),
    );
    formData.append("label", label);
    formData.append("entityType", entityType);
    formData.append("previousUrl", audioUrl);

    const response = await fetch("/api/admin/pronunciations", {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as { url?: string; error?: string };

    if (!response.ok || !data.url) {
      throw new Error(data.error || "Failed to upload pronunciation audio.");
    }

    setAudioUrl(data.url);
  }

  async function startRecording() {
    setError("");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("This browser cannot record audio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        const mime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });

        if (blob.size === 0) {
          setError("No audio was recorded.");
          return;
        }

        try {
          setIsUploading(true);
          await uploadRecording(blob);
        } catch (uploadError) {
          setError(
            uploadError instanceof Error
              ? uploadError.message
              : "Failed to upload pronunciation audio.",
          );
        } finally {
          setIsUploading(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (recordError) {
      setError(
        recordError instanceof Error
          ? recordError.message
          : "Microphone access was denied.",
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  function clearRecording() {
    setAudioUrl("");
    setError("");
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <input type="hidden" name={inputName} value={audioUrl} />

      <div>
        <p className="text-sm font-semibold text-slate-800">Pronunciation Audio</p>
        <p className="text-xs text-slate-500">
          Record yourself saying &quot;{label}&quot; and the waiter will play this exact sound.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {isRecording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Stop Recording
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={isUploading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {audioUrl ? "Re-record Audio" : "Start Recording"}
          </button>
        )}

        <button
          type="button"
          onClick={clearRecording}
          disabled={!audioUrl || isUploading}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Clear Audio
        </button>
      </div>

      {isUploading ? (
        <p className="text-sm font-medium text-blue-700">Uploading audio...</p>
      ) : null}

      {audioUrl ? (
        <audio controls preload="none" src={audioUrl} className="w-full">
          Your browser does not support audio playback.
        </audio>
      ) : (
        <p className="text-sm text-slate-500">No pronunciation audio saved yet.</p>
      )}

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
