"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

const SERIF_STACK = 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'

export default function LegalContent() {
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 280)
    }

    onScroll()
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <main id="top" className="min-h-screen scroll-smooth bg-[#f7f6f2] text-[#1b1a18]">
      <header className="sticky top-0 z-20 border-b border-[#ddd8cf] bg-[#f7f6f2]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="text-sm tracking-[0.22em] text-[#3a342a] uppercase">
            Autoline
          </Link>
          <nav className="flex items-center gap-5 text-xs tracking-[0.16em] text-[#6a6357] uppercase sm:gap-7">
            <a href="#privacy" className="transition-colors hover:text-[#1b1a18]">Privacy</a>
            <a href="#terms" className="transition-colors hover:text-[#1b1a18]">Terms</a>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16 lg:py-20">
        <p className="text-[11px] tracking-[0.2em] text-[#8a8375] uppercase">Legal</p>
        <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">Privacy Policy & Terms of Service</h1>

        <p className="mt-6 text-[15px] leading-relaxed text-gray-700 sm:text-base" style={{ fontFamily: SERIF_STACK }}>
          Autoline is committed to handling customer and service records responsibly. This page explains what we
          collect, how it is used, and the legal terms that apply when users interact with our WhatsApp workflows.
        </p>

        <div className="mt-8 rounded-2xl border border-[#ddd8cf] bg-white/70 p-5 sm:p-6">
          <h2 className="text-sm tracking-[0.14em] text-[#6a6357] uppercase">Table of Contents</h2>
          <div className="mt-4 flex flex-col gap-3 text-sm text-[#2a2722] sm:text-[15px]">
            <a href="#privacy" className="leading-relaxed underline decoration-[#a39984] underline-offset-4">Privacy Policy</a>
            <a href="#deletion" className="leading-relaxed underline decoration-[#a39984] underline-offset-4">Data Deletion Instructions</a>
            <a href="#terms" className="leading-relaxed underline decoration-[#a39984] underline-offset-4">Terms of Service</a>
          </div>
        </div>

        <article id="privacy" className="mt-14 scroll-mt-24 sm:mt-16">
          <h2 className="text-xl sm:text-2xl">Privacy Policy</h2>
          <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-gray-700 sm:text-base" style={{ fontFamily: SERIF_STACK }}>
            <p>
              For vehicle service tracking and communication workflows, Autoline collects WhatsApp identifiers
              including WhatsApp BSUIDs (User IDs) and phone numbers.
            </p>
            <p>
              This data is used to map WhatsApp messages to vehicle service records, job cards, and service update
              notifications so workshop operations can be managed digitally.
            </p>
            <p>
              We do not sell personal data. Access is limited to authorized personnel who manage service operations.
            </p>
          </div>

          <section
            id="deletion"
            className="mt-8 rounded-2xl border-2 border-[#c9c2b3] bg-white p-6 shadow-sm sm:p-8"
            aria-label="Data Deletion Instructions"
          >
            <h3 className="text-xl font-semibold text-[#191713] sm:text-2xl">Data Deletion Instructions</h3>
            <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-gray-700 sm:text-base" style={{ fontFamily: SERIF_STACK }}>
              <p>Users may request complete deletion of their records at any time.</p>
              <p>
                To purge your records, send a WhatsApp message with the word <span className="font-semibold">DELETE</span>{" "}
                or email{" "}
                <a
                  className="underline decoration-[#9a927f] underline-offset-4"
                  href="mailto:abhijithsoonu123456@gmail.com"
                >
                  abhijithsoonu123456@gmail.com
                </a>
                .
              </p>
            </div>
          </section>
        </article>

        <article id="terms" className="mt-14 scroll-mt-24 sm:mt-16">
          <h2 className="text-xl sm:text-2xl">Terms of Service</h2>
          <div className="mt-5 space-y-5 text-[15px] leading-relaxed text-gray-700 sm:text-base" style={{ fontFamily: SERIF_STACK }}>
            <section>
              <h3 className="text-base font-semibold text-[#25221d] sm:text-lg">Acceptance of Terms</h3>
              <p className="mt-2">
                By messaging our WhatsApp number and using Autoline interactions, users acknowledge and agree to these
                Terms of Service.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-[#25221d] sm:text-lg">Service Description</h3>
              <p className="mt-2">
                Autoline is a digital assistant for managing vehicle service records, customer communication history,
                and job cards.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-[#25221d] sm:text-lg">User Responsibilities</h3>
              <p className="mt-2">
                Users must provide accurate vehicle and service information. Users are solely responsible for actions
                taken based on automated notifications delivered by the system.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-[#25221d] sm:text-lg">Prohibited Use</h3>
              <p className="mt-2">
                Users may not spam the bot, abuse messaging flows, or attempt to reverse-engineer, disrupt, or bypass
                API security controls.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-[#25221d] sm:text-lg">Limitation of Liability</h3>
              <p className="mt-2">
                Autoline is not responsible for mechanical issues, workshop execution outcomes, or service delays.
                The platform is an operational management layer and does not replace physical service diagnostics.
              </p>
            </section>
          </div>
        </article>

        <footer className="mt-14 border-t border-[#ddd8cf] pt-6 text-xs tracking-[0.08em] text-[#7c7466] uppercase sm:mt-16">
          Last updated: March 2026
        </footer>
      </section>

      <button
        type="button"
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-5 right-5 rounded-full border border-[#c9c2b3] bg-white px-4 py-2 text-xs tracking-[0.12em] text-[#3b362c] uppercase shadow transition-all sm:bottom-7 sm:right-7 ${
          showBackToTop ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        Back to Top
      </button>
    </main>
  )
}
