import { useEffect, useState } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [manifestUrl, setManifestUrl] = useState("");

  useEffect(() => {
    // Dynamically set manifest URL based on current origin
    setManifestUrl(`${window.location.origin}/tonconnect-manifest.json`);
  }, []);

  if (!manifestUrl) return <>{children}</>;

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      {children}
    </TonConnectUIProvider>
  );
}
