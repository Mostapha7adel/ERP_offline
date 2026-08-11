import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        success: "border-transparent bg-success/10 text-success",
        warning: "border-transparent bg-warning/15 text-warning",
        info: "border-transparent bg-info/10 text-info",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? (
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            variant === "success" && "bg-success",
            variant === "warning" && "bg-warning",
            variant === "info" && "bg-info",
            variant === "destructive" && "bg-destructive",
            variant === "secondary" && "bg-secondary-foreground",
            variant === "muted" && "bg-muted-foreground",
            variant === "default" && "bg-primary-foreground",
          )}
          aria-hidden
        />
      ) : null}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
