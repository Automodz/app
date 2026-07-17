'use client';
import { ReactNode, CSSProperties, ElementType } from 'react';

/**
 * Safe-area layout primitives - the ONLY sanctioned way to handle PWA
 * notch / Dynamic Island / home-indicator spacing. Each maps to a class in
 * globals.css (single source of the env() math). Never write raw
 * env(safe-area-inset-*) in a page; compose these instead.
 *
 *   SafeAreaPage      page container: top + side insets
 *   SafeAreaScroll    scrollable content that must clear bottom chrome
 *                     (pass `nav` when the customer tab bar is present)
 *   SafeAreaHeader    sticky top chrome that owns the status-bar zone
 *   SafeAreaBottomBar fixed bottom chrome (tab bars, sticky CTAs)
 *   SafeAreaSheet     bottom-sheet body: home-indicator padding + notch cap
 */

type BoxProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
};

function box(cls: string) {
  return function SafeAreaBox({ children, className = '', style, as: Tag = 'div' }: BoxProps) {
    return <Tag className={`${cls} ${className}`} style={style}>{children}</Tag>;
  };
}

export const SafeAreaPage = box('safe-page');
export const SafeAreaHeader = box('safe-header');
export const SafeAreaBottomBar = box('safe-bottom-bar');
export const SafeAreaSheet = box('safe-sheet');

export function SafeAreaScroll({ children, className = '', style, nav = false }: BoxProps & { nav?: boolean }) {
  return (
    <div className={`${nav ? 'safe-scroll-nav' : 'safe-scroll'} ${className}`} style={style}>
      {children}
    </div>
  );
}
