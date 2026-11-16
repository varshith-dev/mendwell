"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Route as RouteIcon, Gauge, Map } from "lucide-react";

const items = [
  { href: "/board", label: "Board", icon: Map },
  { href: "/dispatch", label: "Dispatch", icon: Compass },
  { href: "/routes", label: "Routes", icon: RouteIcon },
  { href: "/evidence", label: "Evidence", icon: Gauge },
];

export function OpsNav({ role }: { role: string }) {
  const path = usePathname();
  return (
    <nav className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" aria-label="Main">
      {items
        .filter((i) => (role === "technician" ? i.href !== "/dispatch" : true))
        .map(({ href, label, icon: Icon }) => {
          const on = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
                on ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2"
              }`}
            >
              <Icon className="size-4" /> {label}
            </Link>
          );
        })}
    </nav>
  );
}
