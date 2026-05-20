import { cn } from "@/lib/utils";
import logoOnDark from "@/assets/apoya-logo-light.png"; // logo branca + laranja (para fundos escuros)
import logoOnDarkMono from "@/assets/apoya-logo-light-mono.png"; // logo branca (para fundos escuros)
import logoOnLight from "@/assets/apoya-logo-dark.png"; // logo cinza + laranja (para fundos claros)
import logoOnLightMono from "@/assets/apoya-logo-dark-mono.png"; // logo cinza (para fundos claros)

type Variant = "on-dark" | "on-light" | "on-dark-mono" | "on-light-mono";
type Size = "sm" | "md" | "lg" | "xl";

const SRC: Record<Variant, string> = {
  "on-dark": logoOnDark,
  "on-light": logoOnLight,
  "on-dark-mono": logoOnDarkMono,
  "on-light-mono": logoOnLightMono,
};

const SIZE: Record<Size, string> = {
  sm: "h-5",
  md: "h-7",
  lg: "h-10",
  xl: "h-14",
};

export function ApoyaLogo({
  variant = "on-light",
  size = "md",
  withTagline = true,
  className,
}: {
  variant?: Variant;
  size?: Size;
  /** O PNG já contém a tagline; quando false, recorta visualmente exibindo apenas o "apoya". */
  withTagline?: boolean;
  className?: string;
}) {
  // Proporção do logo completo é ~2.4:1 (com tagline) e ~2:1 (sem tagline).
  // Usamos object-contain + altura controlada para responsividade.
  return (
    <img
      src={SRC[variant]}
      alt="APOYA — Auditoria, Consultoria e Contabilidade"
      className={cn(
        SIZE[size],
        "w-auto object-contain select-none",
        !withTagline && "object-top [clip-path:inset(0_0_30%_0)]",
        className,
      )}
      draggable={false}
    />
  );
}
