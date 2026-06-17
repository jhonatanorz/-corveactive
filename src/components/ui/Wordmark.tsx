import Link from "next/link";

export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`font-display lowercase text-ink ${className}`}>
      corve
    </Link>
  );
}
