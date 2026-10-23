import Image from "next/image";

export function UnderConstruction() {
  return (
    <main className="min-h-dvh glass-canvas flex items-center justify-center p-4">
      <div className="glass rounded-3xl w-full max-w-md p-8 sm:p-12 text-center space-y-6">
        <Image
          src="/westeel-logo-cropped.png"
          alt="Westeel Buildings"
          width={200}
          height={72}
          className="h-14 w-auto mx-auto"
          priority
        />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Under construction</h1>
          <p className="text-sm text-slate-600">We are working on this site. Please check back soon.</p>
        </div>
      </div>
    </main>
  );
}
