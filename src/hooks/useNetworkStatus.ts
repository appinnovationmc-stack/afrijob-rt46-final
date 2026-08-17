import { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';

export function useNetworkStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    Network.getStatus().then((s) => mounted && setOnline(s.connected));
    const listener = Network.addListener('networkStatusChange', (s) => {
      if (mounted) setOnline(s.connected);
    });
    return () => {
      mounted = false;
      listener.then((l) => l.remove());
    };
  }, []);

  return online;
}
