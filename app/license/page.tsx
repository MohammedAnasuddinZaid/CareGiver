import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";

export const metadata: Metadata = {
  title: "License · CareGiver",
  description: "MIT Open Source License terms for CareGiver.",
};

// Kept in sync with the LICENSE file at the repo root.
const LICENSE_TEXT = `Copyright (c) 2026 CareGiver contributors

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
    <div className="min-h-[85vh] px-4 py-16 text-ink md:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="group mb-8 inline-flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-accent-strong"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>

        <header className="mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface-muted px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">
            <Scale className="h-3.5 w-3.5" aria-hidden />
            Open Source
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            MIT License
          </h1>
          <p className="mt-2 text-base text-ink-soft">
            CareGiver is released under the permissive open-source MIT license.
          </p>
        </header>

        <div className="rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-8">
          <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-ink-soft sm:text-base">
            {LICENSE_TEXT}
          </pre>
        </div>
      </div>
    </div>
  );
}
