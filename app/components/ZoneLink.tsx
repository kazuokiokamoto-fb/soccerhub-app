"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ComponentProps } from "react";
import {
  needsHardNavigation,
  zoneFlagsFromEnv,
  type ZoneFlags,
} from "@/lib/selection-frontend/navigation";

function currentZone(): ZoneFlags {
  return zoneFlagsFromEnv({
    NEXT_PUBLIC_APP_ZONE: process.env.NEXT_PUBLIC_APP_ZONE,
    NEXT_PUBLIC_SELECTION_ZONE_ACTIVE: process.env.NEXT_PUBLIC_SELECTION_ZONE_ACTIVE,
  });
}

/** Full page load when the href crosses the hub/selection build boundary. */
export function assignCrossZone(href: string): boolean {
  if (typeof window === "undefined") return false;
  if (!needsHardNavigation(href, currentZone())) return false;
  window.location.assign(href);
  return true;
}

type ZoneLinkProps = ComponentProps<typeof Link>;

export default function ZoneLink({
  href,
  children,
  prefetch,
  replace,
  scroll,
  ...rest
}: ZoneLinkProps) {
  if (typeof href === "string" && needsHardNavigation(href, currentZone())) {
    return (
      <a href={href} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} prefetch={prefetch} replace={replace} scroll={scroll} {...rest}>
      {children}
    </Link>
  );
}
