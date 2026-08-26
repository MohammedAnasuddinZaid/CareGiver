import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = {
  title: "References & Academic Evidence · MemoryAssist",
  description: "Published research papers, clinical guidelines, and cognitive science foundations behind MemoryAssist and Mind Games.",
};

const SECTIONS = [
  {
    title: "Cognitive Stimulation Therapy (CST) & Clinical Guidelines",
    description: "The evidence base for structured cognitive activities, sorting tasks, word games, and executive functioning drills in dementia care.",
    papers: [
      {
        authors: "Spector, A., Orrell, M., Davies, S., & Woods, B.",
        year: "2003",
        title: "Cognitive stimulation therapy (CST): effects on cognition, quality of life and subjective wellbeing in dementia",
        journal: "British Journal of Psychiatry, 183(3), 248–254",
        doi: "10.1192/bjp.183.3.248",
        summary: "Demonstrated that group cognitive stimulation therapy measurably improves cognitive function and quality of life in people with dementia.",
      },
      {
        authors: "National Institute for Health and Care Excellence (NICE)",
        year: "2018 (updated 2024)",
        title: "Dementia: assessment, management and support for people living with dementia and their carers (NICE guideline NG97)",
        journal: "NICE Clinical Guidelines",
        doi: "ng97",
        summary: "Recommends group Cognitive Stimulation Therapy (CST) as the primary non-pharmacological evidence-based intervention for cognitive function in mild-to-moderate dementia.",
      },
    ],
  },
  {
    title: "Spaced Retrieval Training & Name-Face Recall",
    description: "Methodologies for strengthening associative memory by systematically expanding recall intervals.",
    papers: [
      {
        authors: "Camp, C. J.",
        year: "1989",
        title: "Facilitating memory: A cognitive-behavior approach",
        journal: "In The spectrum of aging (pp. 212–225). Springer",
        summary: "Pioneered spaced retrieval training as an effective intervention for memory-impaired older adults, outperforming rote drilling.",
      },
      {
        authors: "Brush, K. E., & Camp, C. J.",
        year: "1998",
        title: "Using spaced retrieval as an intervention across settings",
        journal: "Clinical Gerontologist, 19(1), 51–59",
        doi: "10.1300/J018v19n01_05",
        summary: "Showed that expanding time intervals between successful recalls dramatically improves retention of names, facts, and routines.",
      },
      {
        authors: "Haslam, C., Hodder, K., & Yates, M. J.",
        year: "2011",
        title: "Spaced retrieval training makes peer learning work in dementia",
        journal: "Neuropsychological Rehabilitation, 21(5), 633–651",
        doi: "10.1080/09602011.2011.595679",
        summary: "Controlled trials confirming spaced retrieval superiority over trial-and-error learning in neurodegenerative conditions.",
      },
    ],
  },
  {
    title: "Reminiscence Therapy & Life Review",
    description: "Leveraging preserved remote autobiographical memory and structured life review to enhance mood, engagement, and personal identity.",
    papers: [
      {
        authors: "Butler, R. N.",
        year: "1963",
        title: "The life review: An interpretation of reminiscence in the aged",
        journal: "Psychiatry, 26(1), 65–76",
        doi: "10.1080/00332747.1963.11023339",
        summary: "Foundational clinical paper establishing structured life review as a vital psychological mechanism for older adults and identity preservation.",
      },
      {
        authors: "Woods, B., Spector, A., Jones, C., Orrell, M., & Davies, S.",
        year: "2018",
        title: "Reminiscence therapy for dementia",
        journal: "Cochrane Database of Systematic Reviews, Issue 2. Art. No.: CD001120",
        doi: "10.1002/14651858.CD001120.pub3",
        summary: "Systematic Cochrane review of 22 randomized controlled trials showing consistent improvements in cognition, mood, and social interaction.",
      },
      {
        authors: "Clare, L., Woods, R. T., Moniz Cook, E. D., Orrell, M., & Spector, A.",
        year: "2002",
        title: "Cognitive rehabilitation and cognitive stimulation therapy for early-stage dementia",
        journal: "Health Technology Assessment, 6(31)",
        summary: "Evaluated individualized and group cognitive interventions, highlighting consolidation mechanisms in early memory loss.",
      },
    ],
  },
  {
    title: "Errorless Learning",
    description: "Preventing error consolidation in implicit memory by structuring interactions so wrong attempts never occur.",
    papers: [
      {
        authors: "Wilson, B. A., Baddeley, A. D., Evans, J., & Shiel, A.",
        year: "1994",
        title: "Errorless learning in the rehabilitation of memory impaired people",
        journal: "Neuropsychological Rehabilitation, 4(3), 307–326",
        doi: "10.1080/09602019408401460",
        summary: "Demonstrated that preventing errors during learning significantly enhances skill and fact acquisition in memory-impaired individuals.",
      },
      {
        authors: "Clare, L., & Wilson, B. A.",
        year: "2004",
        title: "Coping with memory loss: A guide to rehabilitative approaches",
        journal: "Psychology Press",
        summary: "Comprehensive review of errorless learning principles applied to daily rehabilitation and assistive technologies.",
      },
    ],
  },
  {
    title: "Adaptive Difficulty, Psychometrics & Flow Theory",
    description: "Maintaining optimal challenge level (~70% success rate) to keep players engaged without frustration.",
    papers: [
      {
        authors: "Rasch, G.",
        year: "1960",
        title: "Probabilistic models for some intelligence and attainment tests",
        journal: "Danish Institute for Educational Research (Expanded: Chicago Press)",
        summary: "Foundations of Item Response Theory (IRT) used to dynamically calibrate task difficulty against estimated player ability.",
      },
      {
        authors: "Csikszentmihalyi, M.",
        year: "1990",
        title: "Flow: The Psychology of Optimal Experience",
        journal: "Harper & Row",
        summary: "Established the flow channel theory where skill level matches task challenge, maximizing intrinsic motivation and engagement.",
      },
    ],
  },
  {
    title: "On-Device Computer Vision & Face Recognition Models",
    description: "Client-side machine learning architecture powering privacy-first face detection and recognition.",
    papers: [
      {
        authors: "Liu, W., Anguelov, D., Erhan, D., Szegedy, C., Reed, S., Fu, C. Y., & Berg, A. C.",
        year: "2016",
        title: "SSD: Single Shot MultiBox Detector",
        journal: "European Conference on Computer Vision (ECCV), Springer, LNCS 9905, 21–37",
        doi: "10.1007/978-3-319-46448-6_2",
        summary: "Efficient object detection architecture adapted in TinyFaceDetector for real-time on-device face localization.",
      },
      {
        authors: "Schroff, F., Kalenichenko, D., & Philbin, J.",
        year: "2015",
        title: "FaceNet: A unified embedding for face recognition and clustering",
        journal: "IEEE Conference on Computer Vision and Pattern Recognition (CVPR), 815–823",
        doi: "10.1109/CVPR.2015.7298682",
        summary: "Learned deep 128-dimensional Euclidean embedding space for faces, forming the architectural basis for face-api.js descriptors.",
      },
      {
        authors: "King, D. E.",
        year: "2009",
        title: "Dlib-ml: A machine learning toolkit",
        journal: "Journal of Machine Learning Research, 10, 1755–1758",
        summary: "Provides facial landmark detection algorithms and robust geometric metrics utilized in landmark alignment and quality gates.",
      },
      {
        authors: "Casiez, G., Roussel, N., & Vogel, D.",
        year: "2012",
        title: "1 € filter: a simple speed-based low-pass filter for noisy input in interactive systems",
        journal: "Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (CHI '12), 2527–2530",
        doi: "10.1145/2207676.2208639",
        summary: "Signal filtering algorithm utilized for smoothing bounding box coordinates and preventing jitter in Companion Mode overlays.",
      },
    ],
  },
];

export default function ReferencesPage() {
  return (
    <div className="min-h-[85vh] px-4 py-12 text-ink md:px-6 md:py-16">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="group mb-8 inline-flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-accent-strong"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>

        <header className="mb-12">
          <StatusBadge tone="accent">Academic & Clinical Pedigree</StatusBadge>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
            References & Research Papers
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            MemoryAssist and Mind Games are not arbitrary software features. Every game mechanic, therapeutic protocol, and privacy-first architectural choice traces back to peer-reviewed dementia research, clinical guidelines, and computer vision literature.
          </p>
        </header>

        <div className="space-y-12">
          {SECTIONS.map((section, idx) => (
            <section key={section.title} className="space-y-4">
              <div className="flex items-center gap-3 border-b border-line pb-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <FlaskConical className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                    {idx + 1}. {section.title}
                  </h2>
                  <p className="text-sm text-ink-soft">{section.description}</p>
                </div>
              </div>

              <div className="grid gap-4">
                {section.papers.map((paper) => (
                  <Card key={paper.title} className="p-6 transition-all hover:border-accent/40">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-accent">
                          {paper.authors} ({paper.year})
                        </p>
                        <h3 className="mt-1 text-lg font-bold leading-snug text-ink">
                          {paper.title}
                        </h3>
                        <p className="mt-1.5 text-sm font-medium text-ink-soft italic">
                          {paper.journal}
                        </p>
                      </div>
                      {paper.doi && (
                        <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-surface-muted px-3 py-1 font-mono text-xs font-semibold text-outline">
                          DOI: {paper.doi}
                        </span>
                      )}
                    </div>
                    <p className="mt-4 border-t border-line/50 pt-3 text-base text-ink-soft">
                      <strong className="text-ink">Key takeaway:</strong> {paper.summary}
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-16 rounded-3xl bg-surface-container-low p-8 text-center border border-line">
          <h3 className="text-xl font-bold text-ink">Open Science & Reproducibility</h3>
          <p className="mt-2 text-base text-ink-soft max-w-2xl mx-auto">
            We believe assistive technology should be transparent, verifiable, and grounded in clinical science. All code and methodologies are openly available under the MIT license.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/about"
              className="inline-flex min-h-[44px] items-center rounded-full bg-surface border border-line px-6 py-2 text-base font-bold text-ink hover:border-accent hover:text-accent transition-all"
            >
              How Recognition Works
            </Link>
            <Link
              href="/license"
              className="inline-flex min-h-[44px] items-center rounded-full bg-accent text-button-text px-6 py-2 text-base font-bold hover:bg-accent-strong transition-all"
            >
              View License
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
