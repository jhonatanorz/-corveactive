"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = { src: string | null; alt: string; sizes?: string; className?: string };

export function FadeImage({ src, alt, sizes = "100vw", className = "" }: Props) {
  const [current, setCurrent] = useState<string | null>(src);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (src === current || src === incoming) return;
    if (src === null) {
      setCurrent(null);
      setIncoming(null);
      return;
    }
    setIncoming(src);
    setOn(false);
  }, [src, current, incoming]);

  useEffect(() => {
    if (!incoming) return;
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, [incoming]);

  if (current === null && incoming === null) return null;
  const base = `object-cover ${className}`;
  return (
    <>
      {current && <Image key={current} src={current} alt={alt} fill sizes={sizes} className={base} />}
      {incoming && (
        <Image
          key={incoming}
          src={incoming}
          alt={alt}
          fill
          sizes={sizes}
          onTransitionEnd={() => {
            setCurrent(incoming);
            setIncoming(null);
            setOn(false);
          }}
          className={`${base} transition-opacity duration-300 ease-out ${on ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </>
  );
}
