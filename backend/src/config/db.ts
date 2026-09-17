import mongoose from "mongoose";
import { env } from "./env";

mongoose.set("strictQuery", true);

let listenersAttached = false;

function attachConnectionListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  if (env.NODE_ENV === "test") return;

  mongoose.connection.on("connected", () => {
    console.log("[mongodb] connected");
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[mongodb] disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("[mongodb] reconnected");
  });
  mongoose.connection.on("error", (err) => {
    console.error("[mongodb] connection error:", err);
  });
}

export async function connectDB(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  attachConnectionListeners();

  return mongoose.connect(uri, {
    // Atlas connections go over the internet, not localhost — fail fast
    // with a clear error instead of hanging if the cluster/URI/network
    // access list is misconfigured.
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 20,
    // Index builds can lock large collections; build them deliberately
    // (migrations/scripts) in production rather than implicitly on boot.
    autoIndex: env.NODE_ENV !== "production",
  });
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}

export function isDBConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
