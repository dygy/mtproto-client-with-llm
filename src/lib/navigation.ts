// @ts-nocheck
// Navigation utilities for Astro with View Transitions
export const navigation = {
  // Navigate to a specific route with smooth transitions
  navigate: (path: string) => {
    if (typeof window !== 'undefined') {
      // Use Astro's View Transitions API if available
      if ('startViewTransition' in document) {
        (document as any).startViewTransition(() => {
          window.location.href = path;
        });
      } else {
        // Fallback for browsers without View Transitions
        window.location.href = path;
      }
    }
  },

  // Navigate back in history
  back: () => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  },

  // Navigate forward in history
  forward: () => {
    if (typeof window !== 'undefined') {
      window.history.forward();
    }
  },

  // Replace current route
  replace: (path: string) => {
    if (typeof window !== 'undefined') {
      window.location.replace(path);
    }
  },

  // Reload current page
  reload: () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  },

  // Get current pathname
  getCurrentPath: (): string => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  },

  // Check if current path matches
  isCurrentPath: (path: string): boolean => {
    return navigation.getCurrentPath() === path;
  },

  // Get query parameters
  getQueryParams: (): URLSearchParams => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  },

  // Add query parameter
  addQueryParam: (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set(key, value);
      window.history.pushState({}, '', url.toString());
    }
  },

  // Remove query parameter
  removeQueryParam: (key: string) => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete(key);
      window.history.pushState({}, '', url.toString());
    }
  },

  // Prefetch a route for faster navigation
  prefetch: (path: string) => {
    if (typeof window !== 'undefined') {
      // Create a link element for prefetching
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = path;
      document.head.appendChild(link);

      // Remove after a short delay to clean up
      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      }, 1000);
    }
  },

  // Preload a route for immediate navigation
  preload: (path: string) => {
    if (typeof window !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = path;
      link.as = 'document';
      document.head.appendChild(link);
    }
  }
};

// Route constants
export const routes = {
  HOME: '/',
  LOGIN: '/',
} as const;

// Navigation guards
export const navigationGuards = {
  // Check if user is authenticated
  requireAuth: (): boolean => {
    if (typeof window !== 'undefined') {
      const sessionId = localStorage.getItem('telegram_session_id');
      const userInfo = localStorage.getItem('telegram_user_info');
      return !!(sessionId && userInfo);
    }
    return false;
  },

  // Redirect to login if not authenticated
  redirectToLogin: () => {
    if (!navigationGuards.requireAuth()) {
      navigation.navigate(routes.LOGIN);
      return false;
    }
    return true;
  },

  // Redirect to home if already authenticated
  redirectToHome: () => {
    if (navigationGuards.requireAuth()) {
      navigation.navigate(routes.HOME);
      return false;
    }
    return true;
  }
};

// URL utilities
export const urlUtils = {
  // Build URL with query parameters
  buildUrl: (path: string, params: Record<string, string> = {}): string => {
    const url = new URL(path, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  },

  // Parse URL and extract parts
  parseUrl: (url: string) => {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol,
      host: parsed.host,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      searchParams: Object.fromEntries(parsed.searchParams.entries())
    };
  },

  // Check if URL is external
  isExternalUrl: (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.origin !== window.location.origin;
    } catch {
      return false;
    }
  }
};
