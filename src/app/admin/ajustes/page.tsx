import { getStoreSettings } from "@/lib/repos/settings";
import SettingsForm from "./SettingsForm";

export default async function AjustesPage() {
  const settings = await getStoreSettings();
  return (
    <div className="p-6 max-w-lg text-sm">
      <h1 className="text-lg font-bold mb-4 text-ink">Ajustes de contacto</h1>
      <p className="text-ink-3 mb-4">Estos datos alimentan el footer de la tienda y el botón de WhatsApp tras el pedido. Deja un campo vacío para ocultarlo.</p>
      <SettingsForm initial={settings} />
    </div>
  );
}
