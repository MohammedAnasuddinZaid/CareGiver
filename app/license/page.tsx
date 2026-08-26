import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";

export const metadata: Metadata = {
  title: "License · MemoryAssist",
  description: "MIT Open Source License terms for MemoryAssist (CareSpeak).",
};

const LICENSE_TEXT = `Copyright (c) 2026 CareSpeak

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

export default function LicensePage() {
  return (
    <div className="min-h-[85vh] bg-[#FAF7F2] text-teal-950 py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950 transition-colors mb-8 group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-900/15 bg-teal-900/5 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-teal-900 mb-4">
            <Scale className="h-3.5 w-3.5" aria-hidden />
            Open Source
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-headline-lg text-teal-950">
            MIT License
          </h1>
          <p className="mt-2 text-base text-teal-900/80">
            MemoryAssist is released under the permissive open-source MIT license.
          </p>
        </header>

        <div className="rounded-3xl border border-teal-900/10 bg-white/80 backdrop-blur-sm p-6 sm:p-8 shadow-sm">
          <pre className="font-mono text-sm sm:text-base leading-relaxed text-teal-950/90 whitespace-pre-wrap break-words">
            {LICENSE_TEXT}
          </pre>
        </div>
      </div>
    </div>
  );
}
