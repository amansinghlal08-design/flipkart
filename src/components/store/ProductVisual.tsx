import {
  BookOpen,
  ChefHat,
  Footprints,
  Gamepad2,
  Headphones,
  Lamp,
  Laptop,
  Package,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Watch,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  mobile: Smartphone,
  laptop: Laptop,
  audio: Headphones,
  wearables: Watch,
  footwear: Footprints,
  apparel: Shirt,
  home: Lamp,
  kitchen: ChefHat,
  beauty: Sparkles,
  toys: Gamepad2,
  books: BookOpen,
  grocery: ShoppingBasket,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category] ?? Package;
  return <Icon className={className} aria-hidden />;
}

/**
 * Monochrome product "artwork": a soft neutral panel with a large line icon.
 * Keeps the catalogue visually consistent under the Minimalism theme without
 * depending on external image hosts.
 */
export function ProductVisual({
  category,
  className,
  iconClassName,
}: {
  category: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-neutral-100",
        className,
      )}
    >
      <CategoryIcon
        category={category}
        className={cn(
          "text-neutral-300 transition-colors duration-300 group-hover:text-neutral-400",
          iconClassName,
        )}
      />
    </div>
  );
}
