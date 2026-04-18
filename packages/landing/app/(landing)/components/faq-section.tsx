'use client';

import { Plus, Minus } from 'lucide-react';
import { useId, useState } from 'react';

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: 'Was this plugin called File Organizer 2000?',
    answer:
      'Yes. <strong>Note Companion</strong> is the same product—we rebranded from File Organizer 2000. If you had the plugin installed or an account before, nothing changes except the name.',
  },
  {
    question: 'How to use the plugin?',
    answer: `<strong>Getting Started</strong>
1. <a href="https://obsidian.md/plugins?id=fileorganizer2000" class="font-medium text-primary underline underline-offset-2 hover:text-primary/90 hover:no-underline">Install the plugin from Obsidian's community plugins</a>
2. Choose your preferred plan
3. You're all set!

<strong>Learn More</strong>
• <a href="https://github.com/Nexus-JPF/note-companion/blob/master/README.md#a-ai-organizer" class="font-medium text-primary underline underline-offset-2 hover:text-primary/90 hover:no-underline">Read our documentation</a> for core features and setup guide

<strong>Video Tutorials</strong>
• Check out our <a href="https://www.youtube.com/playlist?list=PLgRcC-DFR5jcwwg0Dr3gNZrkZxkztraKE" class="font-medium text-primary underline underline-offset-2 hover:text-primary/90 hover:no-underline">comprehensive video tutorials</a> for detailed walkthroughs`,
  },
  {
    question: 'Which models can I use?',
    answer: `<strong>Cloud Service</strong>
• With a subscription, you get access to GPT-4.1-mini model. It's the best all-around model for performance.

<strong>Self-Hosted Option</strong>
• Use any local model of your choice
• Currently supports Ollama local models
• Note: Some configuration may be required

<strong>Coming Soon</strong>
• Full experience powered by local models (Deepseek)
• Enhanced local model support`,
  },
  {
    question: 'Is there a free version?',
    answer:
      "Yes! You can self-host the plugin for free. We also offer a 7-day free trial for our managed service if you prefer a no-hassle experience.\nIf you get enough value out of the plugin, please consider supporting the product. This is an open source initiative we are 100% self-funded. Any contribution helps us continue to maintain and improve the plugin. ❤️",
  },
  {
    question: 'Where is my data stored?',
    answer:
      'In the current cloud version, all data (notes, files, chat messages, transcriptions) is stored and processed outside the European Union, primarily in the United States.',
  },
  {
    question: 'What data is sent to OpenAI?',
    answer:
      "When using AI features, your chat messages, note content, audio files for transcription, and vault context are transmitted to OpenAI (United States). This data is subject to OpenAI's privacy policies and is not end-to-end encrypted.",
  },
  {
    question: 'Is my data encrypted?',
    answer:
      'Yes. Data is encrypted in transit (HTTPS/TLS) and at rest by our infrastructure providers. End-to-end encryption is not implemented as server-side access is required for AI features.',
  },
  {
    question: 'Privacy Policy & Contact',
    answer: `Privacy is important to us. For detailed privacy information, see the questions above.

<strong>Contact Us</strong>
• Email: <a href="mailto:info@notecompanion.ai" class="font-medium text-primary underline underline-offset-2 hover:text-primary/90 hover:no-underline">info@notecompanion.ai</a>
• Discord: <a href="https://discord.com/invite/udQnCRFyus" class="font-medium text-primary underline underline-offset-2 hover:text-primary/90 hover:no-underline">Join our Discord server</a>`,
  },
];

function FaqItem({
  question,
  answer,
  panelId,
}: {
  question: string;
  answer: string;
  panelId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonId = `${panelId}-trigger`;

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-card shadow-sm transition-colors duration-200 ${
        isOpen
          ? 'border-primary/30 ring-1 ring-primary/10'
          : 'border-border hover:border-primary/20'
      }`}
    >
      <button
        id={buttonId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-6 sm:py-5"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="min-w-0 flex-1 font-semibold leading-snug text-foreground">
          {question}
        </span>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors"
          aria-hidden
        >
          {isOpen ? (
            <Minus className="h-4 w-4" strokeWidth={2} />
          ) : (
            <Plus className="h-4 w-4" strokeWidth={2} />
          )}
        </span>
      </button>
      {isOpen && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className="border-t border-border bg-muted/30 px-5 py-4 sm:px-6 sm:py-5"
        >
          <div
            className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground sm:text-base [&_strong]:font-semibold [&_strong]:text-foreground"
            dangerouslySetInnerHTML={{ __html: answer }}
          />
        </div>
      )}
    </div>
  );
}

export function FaqSection() {
  const baseId = useId().replace(/:/g, '');

  return (
    <section
      className="w-full bg-muted/50 py-20 md:py-28"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-3xl px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
          <h2
            id="faq-heading"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            FAQ
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Setup, models, privacy, and how to get help.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:gap-4">
          {FAQ_ITEMS.map((item, index) => (
            <FaqItem
              key={item.question}
              question={item.question}
              answer={item.answer}
              panelId={`faq-panel-${baseId}-${index}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
