import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { UnderConstruction } from "@/components/under-construction";
import { getSiteFlags } from "@/lib/settings/flags";

async function HomeContent() {
  if ((await getSiteFlags()).underConstruction) return <UnderConstruction />;

  return (
    <main className="min-h-dvh glass-canvas flex items-center justify-center p-4">
      <div className="glass rounded-3xl w-full max-w-md p-8 sm:p-12 text-center space-y-8">
        <Image
          src="/westeel-logo-cropped.png"
          alt="Westeel Buildings"
          width={200}
          height={72}
          className="h-14 w-auto mx-auto"
          priority
        />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Westeel Buildings</h1>
          <p className="text-sm text-slate-600">Employee portal</p>
        </div>
        <Link
          href="/employee"
          className="btn-spatial-orange w-full py-3 text-sm flex items-center justify-center gap-2"
        >
          <span>Employee login</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<main className="min-h-dvh glass-canvas" />}>
      <HomeContent />
    </Suspense>
  );
}
