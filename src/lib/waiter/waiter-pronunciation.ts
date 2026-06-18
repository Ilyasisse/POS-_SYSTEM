import type { CartLine } from "@/lib/types";

export type PronunciationSegment = {
  url: string;
  label?: string;
};

let activeAudios: HTMLAudioElement[] = [];

function cleanupAudio(audio: HTMLAudioElement) {
  audio.pause();
  audio.currentTime = 0;
  activeAudios = activeAudios.filter((item) => item !== audio);
}

function normalizeUrl(value: string | null | undefined) {
  return String(value ?? "").trim();
}

export function cancelPronunciationPlayback() {
  for (const audio of activeAudios) {
    cleanupAudio(audio);
  }
}

async function playSingleSegment(segment: PronunciationSegment) {
  const url = normalizeUrl(segment.url);

  if (!url) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const audio = new Audio(url);
    activeAudios.push(audio);

    audio.onended = () => {
      cleanupAudio(audio);
      resolve();
    };

    audio.onerror = () => {
      cleanupAudio(audio);
      reject(new Error(`Failed to play ${segment.label ?? "audio"}.`));
    };

    void audio.play().catch((error) => {
      cleanupAudio(audio);
      reject(error);
    });
  });
}

export function buildCartLinePronunciationSegments(
  line: CartLine,
): PronunciationSegment[] {
  const segments: PronunciationSegment[] = [];

  if (normalizeUrl(line.pronunciationAudioUrl)) {
    segments.push({
      url: line.pronunciationAudioUrl ?? "",
      label: line.name,
    });
  }

  for (const modifier of line.selectedModifiers ?? []) {
    if (!normalizeUrl(modifier.pronunciationAudioUrl)) {
      continue;
    }

    segments.push({
      url: modifier.pronunciationAudioUrl ?? "",
      label: `${line.name} ${modifier.optionName}`,
    });
  }

  return segments;
}

export function buildFullOrderPronunciationSegments(
  lines: CartLine[],
): PronunciationSegment[] {
  return lines.flatMap((line) => buildCartLinePronunciationSegments(line));
}

export async function playPronunciationSegments(
  segments: PronunciationSegment[],
): Promise<string | null> {
  const playableSegments = segments.filter((segment) =>
    Boolean(normalizeUrl(segment.url)),
  );

  if (playableSegments.length === 0) {
    return "No recorded pronunciation was found for this item.";
  }

  cancelPronunciationPlayback();

  try {
    for (const segment of playableSegments) {
      await playSingleSegment(segment);
    }

    return null;
  } catch {
    return "The saved pronunciation audio could not be played.";
  }
}
