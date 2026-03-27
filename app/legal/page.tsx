import type { Metadata } from "next"
import LegalContent from "./legal-content"

export const metadata: Metadata = {
  title: "Autoline | Privacy & Terms",
}

export default function LegalPage() {
  return <LegalContent />
}
