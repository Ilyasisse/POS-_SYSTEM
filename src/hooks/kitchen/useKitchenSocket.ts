"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  filterKitchenTicketByStation,
  getKitchenSocketUrl,
  getKitchenTicketStatusForItems,
  normalizeKitchenStation,
  setKitchenTicketPickupStatus,
  setKitchenTicketStationStatus,
  type KitchenSocketMessage,
  type KitchenTicket,
  type KitchenTicketPickupStatus,
  type KitchenTicketStatus,
  type KitchenViewerRole,
} from "@/lib/kitchen/kitchen-socket";
import { parseKitchenMessage } from "@/components/kitchen/kitchen-utils";
import { translateKitchenStationName } from "@/lib/ui/ui-text";

type SocketStatus = "connecting" | "connected" | "disconnected";

type UseKitchenSocketOptions = {
  station?: string | null;
  currentUserId?: string | null;
  currentUserName?: string | null;
  currentUserRole?: KitchenViewerRole | null;
};

export function useKitchenSocket(options?: UseKitchenSocketOptions) {
  const station = normalizeKitchenStation(options?.station);
  const currentUserId = options?.currentUserId ?? null;
  const currentUserName = options?.currentUserName ?? null;
  const currentUserRole = options?.currentUserRole ?? null;
  const isWaiterPickupViewer =
    !station && (currentUserRole === "WAITER" || currentUserRole === "ADMIN");
  const filterOptions = useMemo(
    () => ({
      station,
      userId: currentUserId,
      role: currentUserRole,
    }),
    [currentUserId, currentUserRole, station],
  );

  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("connecting");
  const [statusMessage, setStatusMessage] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;

    const connect = () => {
      if (disposed) return;

      setSocketStatus("connecting");

      const socketUrl = getKitchenSocketUrl({
        station,
        userId: currentUserId,
        role: currentUserRole,
      });
      const ws = new WebSocket(socketUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }

        setSocketStatus("connected");
        setStatusMessage(
          station
            ? `Connected to the ${translateKitchenStationName(station)} kitchen queue.`
            : "Connected. Waiting for orders...",
        );
      };

      ws.onmessage = (event) => {
        const incoming = parseKitchenMessage(String(event.data));
        if (!incoming) return;

        if (incoming.type === "ORDER_SNAPSHOT") {
          setTickets(
            incoming.payload
              .map((ticket) =>
                filterKitchenTicketByStation(ticket, {
                  station: filterOptions.station,
                  userId: filterOptions.userId,
                  role: filterOptions.role,
                }),
              )
              .filter((ticket): ticket is KitchenTicket => ticket !== null),
          );
          return;
        }

        if (incoming.type === "NEW_ORDER") {
          const filteredTicket = filterKitchenTicketByStation(incoming.payload, {
            station: filterOptions.station,
            userId: filterOptions.userId,
            role: filterOptions.role,
          });

          if (!filteredTicket) {
            return;
          }

          setTickets((current) => {
            const withoutExisting = current.filter(
              (ticket) => ticket.id !== filteredTicket.id,
            );
            return [filteredTicket, ...withoutExisting];
          });

          setStatusMessage(
            `New ticket #${filteredTicket.orderNumber} received`,
          );
          return;
        }

        if (incoming.type === "UPDATE_ORDER_STATUS") {
          const { id, station: updatedStation, status } = incoming.payload;

          setTickets((current) => {
            return current.reduce<KitchenTicket[]>((accumulator, ticket) => {
              if (ticket.id !== id) {
                accumulator.push(ticket);
                return accumulator;
              }

              const nextTicket = filterKitchenTicketByStation(
                setKitchenTicketStationStatus(ticket, updatedStation, status),
                filterOptions,
              );

              if (nextTicket) {
                accumulator.push(nextTicket);
              }

              return accumulator;
            }, []);
          });
          return;
        }

        if (incoming.type === "UPDATE_PICKUP_STATUS") {
          const {
            id,
            pickupStatus,
            claimedByWaiterId,
            claimedByWaiterName,
          } = incoming.payload;

          setTickets((current) => {
            return current.reduce<KitchenTicket[]>((accumulator, ticket) => {
              if (ticket.id !== id) {
                accumulator.push(ticket);
                return accumulator;
              }

              if (pickupStatus === "delivered") {
                return accumulator;
              }

              const nextTicket = filterKitchenTicketByStation(
                setKitchenTicketPickupStatus(
                  ticket,
                  pickupStatus,
                  claimedByWaiterId,
                  claimedByWaiterName,
                ),
                filterOptions,
              );

              if (nextTicket) {
                accumulator.push(nextTicket);
              }

              return accumulator;
            }, []);
          });
        }
      };

      ws.onerror = () => {
        setSocketStatus("disconnected");
      };

      ws.onclose = () => {
        if (disposed) return;

        setSocketStatus("disconnected");
        setStatusMessage("Connection lost. Reconnecting...");
        reconnectTimerRef.current = window.setTimeout(connect, 1500);
      };
    };

    connect();

    return () => {
      disposed = true;

      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }

      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [currentUserId, currentUserRole, filterOptions, station]);

  const activeTickets = useMemo(
    () =>
      isWaiterPickupViewer
        ? tickets.filter(
            (ticket) =>
              getKitchenTicketStatusForItems(ticket, ticket.items) === "done" &&
              ticket.pickupStatus !== "delivered",
          )
        : tickets.filter(
            (ticket) =>
              getKitchenTicketStatusForItems(ticket, ticket.items) !== "done",
          ),
    [isWaiterPickupViewer, tickets],
  );

  const updateTicketStatus = (id: string, status: KitchenTicketStatus) => {
    if (!station) {
      setStatusMessage("Open a station queue to change ticket status.");
      return;
    }

    setTickets((current) => {
      return current.reduce<KitchenTicket[]>((accumulator, ticket) => {
        if (ticket.id !== id) {
          accumulator.push(ticket);
          return accumulator;
        }

        const nextTicket = filterKitchenTicketByStation(
          setKitchenTicketStationStatus(ticket, station, status),
          filterOptions,
        );

        if (nextTicket) {
          accumulator.push(nextTicket);
        }

        return accumulator;
      }, []);
    });

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setStatusMessage(
        "Unable to sync the update. The kitchen connection is offline.",
      );
      return;
    }

    const message: KitchenSocketMessage = {
      type: "UPDATE_ORDER_STATUS",
      payload: { id, station, status },
    };

    socket.send(JSON.stringify(message));
  };

  const updatePickupStatus = (
    id: string,
    pickupStatus: KitchenTicketPickupStatus,
  ) => {
    if (!isWaiterPickupViewer) {
      setStatusMessage("Only the waiter pickup display can update delivery.");
      return;
    }

    const ticket = tickets.find((candidate) => candidate.id === id);

    if (
      pickupStatus === "delivered" &&
      ticket?.claimedByWaiterId &&
      ticket.claimedByWaiterId !== currentUserId &&
      currentUserRole !== "ADMIN"
    ) {
      setStatusMessage("This ticket is claimed by another waiter.");
      return;
    }

    const claimedByWaiterId =
      pickupStatus === "claimed" ? currentUserId : ticket?.claimedByWaiterId;
    const claimedByWaiterName =
      pickupStatus === "claimed" ? currentUserName : ticket?.claimedByWaiterName;

    setTickets((current) => {
      return current.reduce<KitchenTicket[]>((accumulator, currentTicket) => {
        if (currentTicket.id !== id) {
          accumulator.push(currentTicket);
          return accumulator;
        }

        if (pickupStatus === "delivered") {
          return accumulator;
        }

        accumulator.push(
          setKitchenTicketPickupStatus(
            currentTicket,
            pickupStatus,
            claimedByWaiterId,
            claimedByWaiterName,
          ),
        );
        return accumulator;
      }, []);
    });

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setStatusMessage(
        "Unable to sync the pickup update. The kitchen connection is offline.",
      );
      return;
    }

    const message: KitchenSocketMessage = {
      type: "UPDATE_PICKUP_STATUS",
      payload: {
        id,
        pickupStatus,
        claimedByWaiterId,
        claimedByWaiterName,
      },
    };

    socket.send(JSON.stringify(message));
  };

  return {
    tickets,
    activeTickets,
    socketStatus,
    statusMessage,
    updateTicketStatus,
    updatePickupStatus,
  };
}
