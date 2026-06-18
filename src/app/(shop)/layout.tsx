// src/app/(shop)/layout.tsx
import { CartProvider } from "@/lib/cart/CartContext";
import { listActiveLines } from "@/lib/repos/lines";
import { listCategories } from "@/lib/repos/categories";
import ShopChrome from "./ShopChrome";
import Footer from "./Footer";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [lines, categories] = await Promise.all([listActiveLines(), listCategories()]);
  return (
    <CartProvider>
      <div className="min-h-screen bg-white text-ink">
        <ShopChrome
          lines={lines.map((l) => ({ slug: l.slug, name: l.name, hero_title: l.hero_title, hero_message: l.hero_message }))}
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        >
          {children}
        </ShopChrome>
        <Footer />
      </div>
    </CartProvider>
  );
}
