import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";

export function PageAmbientWave({ className }: { className?: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div aria-hidden="true" className={cn("pointer-events-none overflow-visible", className)}>
      {isDark ? (
        <>
          <div className="absolute left-1/2 top-1/2 h-[56rem] w-[56rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(5,8,18,0.92)_0%,rgba(8,12,24,0.82)_18%,rgba(58,20,36,0.18)_34%,rgba(255,96,74,0.08)_48%,rgba(255,96,74,0)_66%)] blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(2,6,18,0.98)_0%,rgba(2,6,18,0.94)_58%,rgba(2,6,18,0)_72%)]" />
          <div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(255,120,92,0.22)] shadow-[0_0_120px_rgba(115,74,255,0.12),0_0_68px_rgba(255,92,72,0.14)]" />
          <div className="absolute left-1/2 top-1/2 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(115,74,255,0.12)]" />
          <div className="absolute left-1/2 top-1/2 h-[44rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(255,132,102,0.1)] shadow-[0_0_40px_rgba(255,170,126,0.06)]" />
          <div className="absolute left-1/2 top-1/2 h-[54rem] w-[54rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(98,78,182,0.08)] shadow-[0_0_56px_rgba(255,182,144,0.05)]" />
          <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_210deg,rgba(255,86,66,0.02),rgba(255,120,92,0.16),rgba(111,78,255,0.08),rgba(255,86,66,0.02))] blur-xl" />
        </>
      ) : (
        <>
          <div className="absolute left-1/2 top-1/2 h-[54rem] w-[54rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,210,138,0.34)_0%,rgba(255,176,102,0.2)_16%,rgba(238,119,74,0.12)_32%,rgba(238,119,74,0.04)_48%,rgba(238,119,74,0)_68%)] blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,248,225,0.8)_0%,rgba(255,224,156,0.42)_24%,rgba(255,188,112,0.16)_46%,rgba(255,188,112,0)_70%)]" />
          <div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(240,146,88,0.22)] shadow-[0_0_96px_rgba(246,177,112,0.16),0_0_48px_rgba(236,118,72,0.08)]" />
          <div className="absolute left-1/2 top-1/2 h-[44rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(243,166,108,0.16)] shadow-[0_0_44px_rgba(249,200,144,0.1)]" />
          <div className="absolute left-1/2 top-1/2 h-[54rem] w-[54rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(246,188,132,0.12)] shadow-[0_0_56px_rgba(251,214,168,0.08)]" />
          <div className="absolute left-1/2 top-1/2 h-[64rem] w-[64rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(251,214,168,0.08)] shadow-[0_0_72px_rgba(255,224,182,0.06)]" />
        </>
      )}

      <div className="hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/wave-light.png"
        alt=""
        className={`absolute left-1/2 bottom-[-8.5rem] w-[118%] max-w-none -translate-x-1/2 object-contain transition-opacity duration-300 ease-out ${
          theme === "dark" ? "opacity-0" : "opacity-100"
        }`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/wave-dark.png"
        alt=""
        className={`absolute left-1/2 bottom-[-8.5rem] w-[118%] max-w-none -translate-x-1/2 object-contain transition-opacity duration-300 ease-out ${
          theme === "dark" ? "opacity-[0.82]" : "opacity-0"
        }`}
      />
      </div>
    </div>
  );
}
