import React from "react";
import { Mail, MessageCircle } from "lucide-react";
import "./product-identity.css";

export const PRODUCT_IDENTITY = {
  attribution: "Prepared & Executed by Eng. Ahmed Mohamed Omar",
  email: "eng.Ahmadomr@gmail.com",
  whatsapp: "01116770951",
  whatsappHref: "https://wa.me/201116770951",
} as const;

type ProductIdentityProps = {
  variant?: "shell" | "sidebar" | "report" | "splash";
};

/** A single, reusable attribution block for app chrome, print, and onboarding. */
export function ProductIdentity({ variant = "shell" }: ProductIdentityProps) {
  return (
    <section className={`product-identity product-identity--${variant}`} dir="ltr" aria-label="TIA Studio authorship and contact information">
      <p>{PRODUCT_IDENTITY.attribution}</p>
      <div className="product-identity__contacts">
        <a href={`mailto:${PRODUCT_IDENTITY.email}`} aria-label={`Email ${PRODUCT_IDENTITY.email}`}>
          <Mail aria-hidden="true" size={13} />
          <span>{PRODUCT_IDENTITY.email}</span>
        </a>
        <a href={PRODUCT_IDENTITY.whatsappHref} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${PRODUCT_IDENTITY.whatsapp}`}>
          <MessageCircle aria-hidden="true" size={13} />
          <span>WhatsApp {PRODUCT_IDENTITY.whatsapp}</span>
        </a>
      </div>
    </section>
  );
}
