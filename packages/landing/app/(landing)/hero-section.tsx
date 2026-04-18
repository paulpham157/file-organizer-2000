'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { HeroShimmerCta } from './components/hero-shimmer-cta';
import { ArrowRight, Play } from 'lucide-react';

const HERO_EMBED_SRC =
  'https://www.youtube.com/embed/X4yN4ykTJIo?iv_load_policy=3&rel=0&modestbranding=1&playsinline=1&autoplay=1&mute=1';

export function HeroSection() {
  const reduceMotion = useReducedMotion();

  const listVariants = {
    hidden: {},
    visible: {
      transition: reduceMotion
        ? { duration: 0 }
        : { staggerChildren: 0.07 },
    },
  };

  const fadeUp = {
    hidden: {
      opacity: reduceMotion ? 1 : 0,
      y: reduceMotion ? 0 : 16,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: reduceMotion
        ? { duration: 0 }
        : { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-16 md:py-20 lg:py-28">
      <motion.div
        className="grid items-center gap-12 lg:grid-cols-2 lg:gap-14"
        initial={reduceMotion ? 'visible' : 'hidden'}
        animate="visible"
        variants={listVariants}
      >
        <div className="flex flex-col text-center lg:text-left">
          <motion.p
            variants={fadeUp}
            className="mb-6 text-sm font-medium uppercase tracking-wide text-muted-foreground"
          >
            AI plugin for Obsidian
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
          >
            <span>Keep your Vault</span>
            <span className="block text-primary">Organized</span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-4 text-lg font-medium leading-snug tracking-tight text-muted-foreground sm:text-xl"
          >
            without the hassle
          </motion.p>
          <motion.p
            variants={fadeUp}
            className="mt-6 text-lg leading-8 text-muted-foreground"
          >
            Note Companion is an AI-powered Obsidian plugin that improves your
            workflow by automatically organizing and formatting your notes—so you
            don&apos;t have to.
          </motion.p>
          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start"
          >
            <HeroShimmerCta
              href="https://accounts.notecompanion.ai/sign-up"
              reduceMotion={!!reduceMotion}
              className="lg:mx-0"
            >
              Get Started
              <ArrowRight className="h-4 w-4" aria-hidden />
            </HeroShimmerCta>
            <a href="#demo" className="lg:hidden">
              <Button size="lg" variant="outline" className="gap-2 border-primary/25 hover:border-primary/40 hover:bg-primary/5">
                <Play className="h-4 w-4" />
                Watch demo
              </Button>
            </a>
          </motion.div>
        </div>

        <motion.div
          variants={fadeUp}
          id="demo"
          className="relative w-full scroll-mt-24"
        >
          <div className="relative aspect-video overflow-hidden rounded-2xl ring-1 ring-border shadow-sm">
            <iframe
              title="Note Companion demo video"
              src={HERO_EMBED_SRC}
              style={{ border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
              suppressHydrationWarning
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
