import Image from "next/image";
import logo from "@/app/images/logoz.png";

export function LogoLoader({ className = "min-h-dvh" }: { className?: string }) {
  return (
    <main className={`flex items-center justify-center bg-[#f7f9fd] ${className}`} aria-label="Loading CASTARZ">
      <div className="rounded-[28px] bg-white/70 px-8 py-6 shadow-sm ring-1 ring-white/80 backdrop-blur">
        <Image src={logo} alt="CASTARZ" priority className="h-auto w-56 animate-pulse sm:w-64" />
      </div>
    </main>
  );
}
