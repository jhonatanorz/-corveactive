import { describe, it, expect } from "vitest";
import { buildWhatsAppLink } from "@/domain/whatsapp";

describe("buildWhatsAppLink", () => {
  it("builds a wa.me link with a url-encoded message", () => {
    const link = buildWhatsAppLink("52 (55) 1234-5678", "Hola CORVE, pedido #abc");
    expect(link).toBe("https://wa.me/525512345678?text=Hola%20CORVE%2C%20pedido%20%23abc");
  });
  it("strips all non-digits from the phone", () => {
    expect(buildWhatsAppLink("+52-55-0000", "x")).toBe("https://wa.me/52550000?text=x");
  });
});
