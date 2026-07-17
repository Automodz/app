import { Shield, Droplets, Sparkles, Gem, Wrench, Award, Crown, Star, type LucideIcon } from 'lucide-react';

/**
 * Single source of truth for service-category iconography. Replaces the old
 * emoji `getCategoryIcon()` - every surface (bookings, schedule, dashboard,
 * store, recipes, settings) renders the SAME professional Lucide glyph per
 * category, so the language stays consistent across the whole platform.
 */
const CATEGORY_ICON: Record<string, LucideIcon> = {
  PPF: Shield,        // paint protection film - armour
  Washing: Droplets,  // wash & care
  Ceramic: Sparkles,  // ceramic gloss
  Coating: Gem,       // detailing / polish depth
};

export function serviceIconFor(category?: string): LucideIcon {
  return (category && CATEGORY_ICON[category]) || Wrench;
}

/** Membership-tier icons - Silver / Gold / Platinum, one source of truth. */
const PLAN_ICON: Record<string, LucideIcon> = {
  Silver: Award,
  Gold: Crown,
  Platinum: Gem,
};

export function planIconFor(plan?: string): LucideIcon {
  return (plan && PLAN_ICON[plan]) || Star;
}

export function PlanIcon({
  plan,
  size = 18,
  className,
  style,
}: {
  plan?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = planIconFor(plan);
  return <Icon size={size} className={className} style={style} aria-hidden />;
}

export default function ServiceIcon({
  category,
  size = 18,
  className,
  style,
  strokeWidth = 2,
}: {
  category?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}) {
  const Icon = serviceIconFor(category);
  return <Icon size={size} className={className} style={style} strokeWidth={strokeWidth} aria-hidden />;
}
