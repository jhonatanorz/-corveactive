import { getStoreSettings } from "@/lib/repos/settings";
import { buildWhatsAppLink } from "@/domain/whatsapp";

const ICON_BASE =
  "w-10 h-10 rounded-pill bg-white/15 flex items-center justify-center text-ink-on-royal";
const ICON_LINK = `${ICON_BASE} hover:bg-white/30 transition`;

export default async function Footer() {
  const { whatsapp, instagram_url, tiktok_url } = await getStoreSettings();
  const waLink = whatsapp ? buildWhatsAppLink(whatsapp, "Hola CORVE 💛") : null;

  return (
    <footer className="bg-royal text-ink-on-royal">
      <div className="max-w-2xl mx-auto px-6 py-12 md:py-16">
        <p className="text-base md:text-lg leading-relaxed">
          Creemos en mover el cuerpo desde el amor, no desde la exigencia. Honramos los
          procesos, la comodidad, la seguridad y la libertad. CORVE es corazón en movimiento.
        </p>
        <div className="flex gap-3 mt-6">
          {instagram_url && (
            <a href={instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={ICON_LINK}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
              </svg>
            </a>
          )}
          {tiktok_url && (
            <a href={tiktok_url} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className={ICON_LINK}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 3h2.6c.3 1.9 1.6 3.4 3.4 3.9v2.6c-1.3 0-2.5-.35-3.6-1v6.2A5.6 5.6 0 1 1 11.6 10v2.7c-.3-.1-.6-.1-.9-.1a2.9 2.9 0 1 0 2.9 2.9V3z" />
              </svg>
            </a>
          )}
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={ICON_LINK}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.8c2.17 0 4.21.85 5.74 2.38a8.06 8.06 0 0 1 2.38 5.73c0 4.54-3.7 8.23-8.24 8.23-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.12.82.83-3.04-.2-.31a8.16 8.16 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23zm-3.7 4.32c-.18 0-.46.07-.7.33-.24.26-.92.9-.92 2.2 0 1.3.94 2.55 1.07 2.73.13.18 1.85 2.82 4.48 3.96.63.27 1.12.43 1.5.55.63.2 1.2.17 1.66.1.5-.07 1.56-.64 1.78-1.25.22-.61.22-1.14.16-1.25-.07-.11-.24-.18-.5-.31-.26-.13-1.56-.77-1.8-.86-.24-.09-.42-.13-.6.13-.18.26-.69.86-.84 1.04-.16.18-.31.2-.57.07-.26-.13-1.11-.41-2.11-1.3-.78-.7-1.31-1.56-1.46-1.82-.16-.26-.02-.4.11-.53.12-.12.26-.31.4-.46.13-.16.18-.26.26-.44.09-.18.04-.33-.02-.46-.07-.13-.6-1.45-.82-1.98-.22-.52-.44-.45-.6-.46h-.51z" />
              </svg>
            </a>
          )}
        </div>
        <div className="mt-8 text-xs text-ink-on-royal/70">© CORVE · Confianza en cada movimiento</div>
      </div>
    </footer>
  );
}
