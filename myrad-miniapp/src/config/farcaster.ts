// src/config/farcaster.ts
import { sdk } from "@farcaster/miniapp-sdk";

export const initFarcasterMiniApp = () => {
  // Tell Farcaster mini app viewer that the app is ready
  sdk.actions.ready();
};
