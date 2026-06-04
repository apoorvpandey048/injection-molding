import { useEffect } from "react";
import { IMMClient, type Snapshot } from "./api";
import { useStore } from "@/store/store";

// One shared client for the whole app (the WebSocket is a singleton resource).
let sharedClient: IMMClient | null = null;
export function getClient(): IMMClient {
  if (!sharedClient) {
    sharedClient = new IMMClient();
    sharedClient.connect();
  }
  return sharedClient;
}

/**
 * Subscribe the Zustand store to the live cycle stream. Mounted once near the
 * app root. Pushes each snapshot into the store (which also maintains the
 * per-subsystem history ring-buffer) and tracks connection state.
 */
export function useLiveData(): void {
  const ingest = useStore((s) => s.ingestSnapshot);
  const setConnected = useStore((s) => s.setConnected);

  useEffect(() => {
    const client = getClient();
    const handler = (snap: Snapshot): void => ingest(snap);
    client.onSnapshot(handler);
    const id = window.setInterval(() => {
      setConnected(client.readyState === WebSocket.OPEN);
    }, 500);
    return () => {
      client.offSnapshot(handler);
      window.clearInterval(id);
    };
  }, [ingest, setConnected]);
}
