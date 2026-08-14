/**
 * THE COMPONENT LIBRARY
 *
 * Source of truth: docs/AUTOMODZ-OS.md
 * Tokens: design/
 *
 * Eighteen components, each one traceable to a section of the constitution and
 * built from tokens alone. §22.4 - no raw colour, spacing, size, duration or
 * stacking order appears in any of them.
 *
 * WHAT THESE DO NOT KNOW
 * Nothing here knows about cars, visits, protections, memberships, the studio,
 * or AutoModz. That is deliberate and it is what makes §22.2 possible: the
 * product's meaning lives in one place, and these render whatever it hands
 * them. A component that learned what a vehicle was would become a second
 * place for that answer to live.
 *
 * WHY THE VARIANTS ARE THE VARIANTS
 * Every variant offered is one the constitution names, and no others:
 *   Text     body · data · whisper            §9.5
 *   Heading  display · title                  §9.5
 *   Button   primary · forward · quiet        §10.4
 *   Surface  the seven elevation bands        §9.3   (one material - §10.2)
 *   StatusChip  assent · caution · urgent · lapsed   §9.2
 *
 * §10.3 - composition over configuration. `Hero` takes its media as children
 * rather than a src, `Gallery` takes tiles rather than URLs, `Section` takes an
 * action rather than a set of flags describing one.
 */

export { Text } from './Text';
export type { TextProps, TextRole } from './Text';

export { Heading } from './Heading';
export type { HeadingProps, HeadingLevel } from './Heading';

export { Button } from './Button';
export type { ButtonProps, ButtonTier } from './Button';

export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';

export { Surface } from './Surface';
export type { SurfaceProps } from './Surface';

export { Divider } from './Divider';
export type { DividerProps } from './Divider';

export { Badge } from './Badge';
export type { BadgeProps } from './Badge';

export { StatusChip } from './StatusChip';
export type { StatusChipProps } from './StatusChip';

export { Hero } from './Hero';
export type { HeroProps, HeroBand } from './Hero';

export { Section } from './Section';
export type { SectionProps } from './Section';

export { ProgressRing } from './ProgressRing';
export type { ProgressRingProps } from './ProgressRing';

export { Timeline } from './Timeline';
export type { TimelineProps, TimelineStep } from './Timeline';

export { Gallery } from './Gallery';
export type { GalleryProps } from './Gallery';

export { BottomSheet } from './BottomSheet';
export type { BottomSheetProps } from './BottomSheet';

export { StudioBoot } from './StudioBoot';

export { LiveRefresh } from './LiveRefresh';
export type { LiveRefreshProps } from './LiveRefresh';

export { Desk } from './Desk';
export type { DeskProps, DeskItem } from './Desk';

export { useOnline } from './useOnline';

export { Ambient } from './Ambient';

export { Glass } from './Glass';
export type { GlassProps } from './Glass';

export { OfflineNote } from './OfflineNote';
export type { OfflineNoteProps } from './OfflineNote';

export { Expansion } from './Expansion';
export type { ExpansionProps } from './Expansion';

export { Modal } from './Modal';
export type { ModalProps } from './Modal';

export { Loading } from './Loading';
export type { LoadingProps } from './Loading';

export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { Toast } from './Toast';
export type { ToastProps } from './Toast';

export { toneColor } from './tone';
export type { Tone, InkTone, OverTone } from './tone';
