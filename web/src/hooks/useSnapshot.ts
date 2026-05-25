import { useEffect, useRef, useState } from "react";
import { IMMClient, type Snapshot } from "@/api";

export interface UseSnapshotResult {
  snapshot: Snapshot | null;
  connected: boolean;
  client: IMMClient;
}

let sharedClient: IMMClient | null = null;
function getClient(): IMMClient {
  if (!sharedClient) {
    sharedClient = new IMMClient();
    sharedClient.connect();
  }
  return sharedClient;
}

export function useSnapshot(): UseSnapshotResult {
  const client = getClient();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const clientRef = useRef(client);

  useEffect(() => {
    const handler = (snap: Snapshot): void => setSnapshot(snap);
    client.onSnapshot(handler);
    const id = window.setInterval(() => {
      setConnected(client.readyState === WebSocket.OPEN);
    }, 500);
    return () => {
      client.offSnapshot(handler);
      window.clearInterval(id);
    };
  }, [client]);

  return { snapshot, connected, client: clientRef.current };
}
