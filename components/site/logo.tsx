import Link from "next/link";

export function Mark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill="var(--ink)" />
      <path d="M6 20c3.2-3 6.4-3 9.6 0s6.4 3 10.4 0" fill="none" stroke="#9fe3f2" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 24.5c2.7-2.2 5.4-2.2 8.1 0s5.4 2.2 7.9 0" fill="none" stroke="#9fe3f2" strokeOpacity=".55" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16 6.2c2.6 3.4 4 5.6 4 7.6a4 4 0 0 1-8 0c0-2 1.4-4.2 4-7.6z" fill="var(--signal)" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5">
      <Mark />
      <span className="display text-[1.35rem] leading-none tracking-tight">Mendwell</span>
    </Link>
  );
}
