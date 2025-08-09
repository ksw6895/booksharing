import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingContextType {
  isLoading: boolean;
  loadingMessage: string | null;
  setLoading: (loading: boolean, message?: string) => void;
  withLoading: <T>(promise: Promise<T>, message?: string) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [loadingCount, setLoadingCount] = useState(0);

  const setLoading = useCallback((loading: boolean, message?: string) => {
    setLoadingCount(prev => {
      const newCount = loading ? prev + 1 : Math.max(0, prev - 1);
      
      if (newCount === 0) {
        setIsLoading(false);
        setLoadingMessage(null);
      } else {
        setIsLoading(true);
        if (message) {
          setLoadingMessage(message);
        }
      }
      
      return newCount;
    });
  }, []);

  const withLoading = useCallback(async <T,>(
    promise: Promise<T>,
    message?: string
  ): Promise<T> => {
    setLoading(true, message);
    try {
      const result = await promise;
      return result;
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  return (
    <LoadingContext.Provider value={{ isLoading, loadingMessage, setLoading, withLoading }}>
      {children}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 shadow-xl flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            {loadingMessage && (
              <p className="text-sm text-muted-foreground">{loadingMessage}</p>
            )}
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

// HOC for wrapping async functions with loading state
export function withLoadingState<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  message?: string
): T {
  return (async (...args: Parameters<T>) => {
    const context = useContext(LoadingContext);
    if (!context) {
      return fn(...args);
    }
    
    return context.withLoading(fn(...args), message);
  }) as T;
}