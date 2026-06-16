import Link from 'next/link';

export function AppHeader({
  subtitle,
  back,
}: {
  subtitle?: string;
  back?: { href: string; label: string };
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Andalusia Academy</h1>
          <p className="text-sm text-slate-500">{subtitle ?? 'WhatsApp enquiry inbox → leads'}</p>
        </div>
        {back && (
          <Link href={back.href} className="shrink-0 text-sm font-medium text-blue-600">
            {back.label}
          </Link>
        )}
      </div>
    </header>
  );
}
