import type { ReactNode } from "react";

/** A fixed bottom action bar (floating CTA). Pages using it should add bottom
 *  padding (e.g. `pb-28`) so content isn't hidden behind it. */
export function FloatingBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur p-4">
      <div className="max-w-md md:max-w-4xl mx-auto">{children}</div>
    </div>
  );
}
