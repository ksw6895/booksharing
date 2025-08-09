import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    kakao: any;
  }
}

const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_API_KEY || '';
const KAKAO_SDK_URL = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_API_KEY}&libraries=services&autoload=false`;

export function useKakaoMaps() {
  const [ready, setReady] = useState<boolean>(
    typeof window !== 'undefined' && !!(window.kakao && window.kakao.maps && window.kakao.maps.services)
  );
  const loadingPromiseRef = useRef<Promise<void> | null>(null);

  const ensureLoaded = useCallback((): Promise<void> => {
    if (ready) return Promise.resolve();
    if (loadingPromiseRef.current) return loadingPromiseRef.current;

    loadingPromiseRef.current = new Promise<void>((resolve, reject) => {
      const finalize = () => {
        const hasServices = !!(window.kakao && window.kakao.maps && window.kakao.maps.services);
        if (!hasServices) {
          reject(new Error('Kakao Maps services not available'));
          return;
        }
        setReady(true);
        resolve();
      };

      const loadMaps = () => {
        if (window.kakao && window.kakao.maps && typeof window.kakao.maps.load === 'function') {
          window.kakao.maps.load(finalize);
        } else {
          // Fallback: wait a tick and check again
          setTimeout(() => {
            if (window.kakao && window.kakao.maps && typeof window.kakao.maps.load === 'function') {
              window.kakao.maps.load(finalize);
            } else {
              finalize();
            }
          }, 0);
        }
      };

      // If kakao object is already present
      if (window.kakao && window.kakao.maps) {
        loadMaps();
        return;
      }

      // Check if script already exists
      let script = document.querySelector(
        'script[src*="dapi.kakao.com/v2/maps/sdk.js"]'
      ) as HTMLScriptElement | null;

      if (!script) {
        script = document.createElement('script');
        script.src = KAKAO_SDK_URL;
        script.async = true;
        script.onload = loadMaps;
        script.onerror = () => reject(new Error('Kakao Maps SDK load failed'));
        document.head.appendChild(script);
      } else {
        script.addEventListener('load', loadMaps, { once: true });
        script.addEventListener('error', () => reject(new Error('Kakao Maps SDK load failed')), { once: true });
        // If it was already loaded before listeners attached
        if ((script as any).readyState === 'complete' || (window as any).kakao?.maps) {
          loadMaps();
        }
      }
    });

    return loadingPromiseRef.current;
  }, [ready]);

  useEffect(() => {
    if (ready) return;
    // best effort: if kakao is already there, mark as ready
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      setReady(true);
    }
  }, [ready]);

  return { ready, ensureLoaded };
}
