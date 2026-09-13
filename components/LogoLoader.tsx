import Image from "next/image";
import logo from "@/app/images/logoz.png";

export function LogoLoader({ className = "min-h-dvh" }: { className?: string }) {
  return (
    <main className={`flex items-center justify-center bg-white ${className}`} aria-label="Loading CASTARZ">
      <Image src={logo} alt="CASTARZ" priority className="h-auto w-56 animate-pulse sm:w-64" />
    </main>
  );
}
