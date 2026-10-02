import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

export const buttonVariants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(17_17_19/0.2)]",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-hover hover:border-line-strong shadow-card",
  ghost: "text-muted hover:bg-hover hover:text-ink",
  danger: "bg-surface text-critical border border-critical/25 hover:bg-critical-bg shadow-card",
};
export const buttonSizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-[13px] gap-2",
  lg: "h-10 px-4 text-sm gap-2",
  icon: "size-9 justify-center",
  "icon-sm": "size-8 justify-center",
};
export const buttonBase =
  "inline-flex shrink-0 items-center rounded-lg font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0";

/** Button styling for elements that aren't <button>, e.g. a Next <Link>. */
export const buttonClass = (variant: Variant = "secondary", size: Size = "md", className?: string) => cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...props}>
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});
