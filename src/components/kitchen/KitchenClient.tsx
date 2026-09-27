"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import {
  playNewTicketTone,
  unseenTicketIds,
} from "@/lib/kitchen/new-ticket-alert";

import type {
  KitchenStation,
  KitchenTicket,
} from "@/lib/kitchen/kitchen-socket";
import KitchenEmptyState from "./KitchenEmptyState";
import KitchenHeader from "./KitchenHeader";
import KitchenStatusBanner from "./KitchenStatusBanner";
import KitchenTicketList from "./KitchenTicketList";
import { useKitchenTickets } from "@/hooks/kitchen/useKitchenTickets";

type KitchenClientProps = {
  station?: KitchenStation;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
};

export default function KitchenClient({
  station,
  currentUserId,
  currentUserName,
  currentUserRole,
}: KitchenClientProps) {
  const { toast } = useToast();
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const seenTicketIds = useRef(new Set<string>());
  const initializedTickets = useRef(false);
  const {
    activeTickets,
    hasLoadedTickets,
    statusMessage,
    updateTicketStatus,
    recordQualityEvent,
  } = useKitchenTickets({
    station,
    currentUserId,
    currentUserName,
    currentUserRole,
  });

  const visibleTickets: KitchenTicket[] = activeTickets;
  const canUpdateStatus = Boolean(station);

  useEffect(() => {
    if (!hasLoadedTickets) return;
    const unseen = unseenTicketIds(seenTicketIds.current, activeTickets);
    for (const id of unseen) seenTicketIds.current.add(id);
    if (initializedTickets.current) {
      if (
        soundEnabled &&
        unseen.length > 0 &&
        document.visibilityState === "visible" &&
        audioRef.current
      ) {
        playNewTicketTone(audioRef.current);
      }
    } else {
      initializedTickets.current = true;
    }
  }, [activeTickets, hasLoadedTickets, soundEnabled]);

  useEffect(
    () => () => {
      if (audioRef.current) void audioRef.current.close();
    },
    [],
  );

  async function toggleSound() {
    if (soundEnabled) {
      setSoundEnabled(false);
      if (audioRef.current) void audioRef.current.close();
      audioRef.current = null;
      toast({ tone: "info", description: "New-ticket sound turned off." });
      return;
    }
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      await context.resume();
      audioRef.current = context;
      setSoundEnabled(true);
      toast({
        tone: "success",
        description: "New-ticket sound turned on for this kitchen screen.",
      });
    } catch {
      if (context) void context.close();
      toast({
        tone: "warning",
        description:
          "Sound could not start. Check that this browser allows audio, then try again.",
      });
    }
  }

  return (
    <div
      className="dark min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-6 text-slate-100 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <KitchenHeader
          queueCount={visibleTickets.length}
          station={station}
          currentUserName={currentUserName}
          currentUserRole={currentUserRole}
        />

        <KitchenStatusBanner message={statusMessage} />

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-800/80 p-4">
          <p className="text-sm text-slate-300">
            Play a cue when a new ticket reaches this screen. Sound starts only
            after you turn it on.
          </p>
          <button
            type="button"
            onClick={() => void toggleSound()}
            aria-pressed={soundEnabled}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${soundEnabled ? "bg-amber-400 text-slate-950" : "bg-slate-700 text-white hover:bg-slate-600"}`}
          >
            {soundEnabled ? "Sound on" : "Enable sound"}
          </button>
        </div>

        {visibleTickets.length === 0 ? (
          <KitchenEmptyState />
        ) : (
          <KitchenTicketList
            tickets={visibleTickets}
            onUpdateStatus={updateTicketStatus}
            canUpdateStatus={canUpdateStatus}
            onRecordQuality={recordQualityEvent}
          />
        )}
      </div>
    </div>
  );
}
