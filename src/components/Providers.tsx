"use client";

import { useEffect, useState } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [manifestUrl, setManifestUrl] = useState("");

  useEffect(() => {
    // Dynamically set manifest URL based on current origin
    setManifestUrl(`${window.location.origin}/tonconnect-manifest.json`);
  }, []);

  if (!manifestUrl) return null; // Ensure we don't render children before the provider is set

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      {children}
    </TonConnectUIProvider>
  );
}
