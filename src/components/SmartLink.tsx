// @ts-nocheck
import React, { useRef, useCallback } from 'react';
import { navigation } from '../lib/navigation';

interface SmartLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  prefetch?: boolean;
  replace?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

const SmartLink: React.FC<SmartLinkProps> = ({
  href,
  children,
  className = '',
  prefetch = true,
  replace = false,
  onClick,
  ...rest
}) => {
  const prefetchedRef = useRef(false);

  const handleMouseEnter = useCallback(() => {
    // Only prefetch once and if enabled
    if (prefetch && !prefetchedRef.current && href) {
      navigation.prefetch(href);
      prefetchedRef.current = true;
    }
  }, [href, prefetch]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    // Call custom onClick if provided
    if (onClick) {
      onClick(e);
    }

    // Prevent default navigation if we're handling it
    if (href && !e.defaultPrevented && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();

      if (replace) {
        navigation.replace(href);
      } else {
        navigation.navigate(href);
      }
    }
  }, [href, replace, onClick]);

  return (
    <a
      href={href}
      className={className}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </a>
  );
};

export default SmartLink;
