import React from "react";
import { cn } from "@/lib/utils";

export interface ModuleNavItem {
  id: string;
  label: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export interface ModuleNavProps {
  items: ModuleNavItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function ModuleNav({ items, active, onChange, className }: ModuleNavProps) {
  return (
    <div className={cn("flex items-center gap-1 border-b border-border pb-0 mb-6", className)}>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md transition-colors duration-150",
              isActive
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{item.label}</span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
