import React from 'react';
import { motion } from 'framer-motion';
import { SignedOut, SignInButton, SignUpButton } from '@clerk/clerk-react';
import { Button } from '../components/ui/button.jsx';

export default function Landing() {
  // Animation presets
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.15 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };
  const fadeIn = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } },
  };
  return (
    <div className="px-4 sm:px-8 lg:px-16 pb-24">
      {/* Hero */}
      <motion.section
        id="home"
        className="pt-16 text-center max-w-5xl mx-auto scroll-mt-24"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        variants={container}
      >
        <motion.h1 variants={fadeUp} className="text-5xl md:text-6xl font-extrabold tracking-tight gradient-text">
          Moodcast
        </motion.h1>
        <motion.p variants={fadeUp} className="mt-6 text-lg md:text-xl text-[var(--text-1)] leading-relaxed">
          Discover and play the perfect soundtrack for every mood.
          Curated YouTube music with a slick, minimal player.
        </motion.p>
        <motion.div variants={fadeUp} className="mt-10 flex items-center justify-center gap-4">
          <SignedOut>
            <SignUpButton mode="modal">
              <Button size="lg" className="px-8">Sign up</Button>
            </SignUpButton>
            <SignInButton mode="modal">
              <Button size="lg" variant="outline" className="px-8">Log in</Button>
            </SignInButton>
          </SignedOut>
        </motion.div>
        <motion.p variants={fadeUp} className="mt-8 text-[var(--text-2)] text-sm md:text-base italic max-w-3xl mx-auto">
          “Music is the shorthand of emotion.” — Leo Tolstoy
        </motion.p>
      </motion.section>

      {/* Showcase/Preview */}
      <motion.section
        className="mt-20 max-w-6xl mx-auto"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={container}
      >
        <motion.div variants={fadeUp} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-1)]/60 backdrop-blur-md p-6 md:p-10 shadow-xl">
          <motion.div variants={fadeIn} className="aspect-video w-full rounded-2xl bg-gradient-to-br from-[var(--bg-2)] to-[var(--bg-0)] grid place-items-center text-[var(--text-2)]">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-[var(--text-0)]">Beautiful, distraction-free player</div>
              <div className="mt-3 text-base md:text-lg">A crafted interface that keeps the focus on your music.</div>
              <div className="mt-6 inline-flex gap-2 items-center text-sm md:text-base text-[var(--text-1)]">
                <span>• Smart search</span>
                <span>• Mini-player</span>
                <span>• Playlists & likes</span>
                <span>• Dark mode</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Features */}
      <motion.section
        className="mt-20 max-w-6xl mx-auto"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={container}
      >
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { title: 'Only music. No clutter.', desc: 'We filter YouTube to deliver music-only results — no reels, no movies.' },
            { title: 'Playlists that fit you', desc: 'Save favorites and craft your mood-based collections in seconds.' },
            { title: 'Crisp, classic UI', desc: 'Thoughtful typography and refined contrast for long, comfy sessions.' },
          ].map((f, i) => (
            <motion.div key={i} variants={fadeUp} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-0)] p-6 shadow-lg">
              <div className="text-xl font-bold text-[var(--text-0)]">{f.title}</div>
              <div className="mt-2 text-[var(--text-1)]">{f.desc}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Rooms Advertisement */}
      <motion.section
        id="rooms"
        className="mt-20 max-w-6xl mx-auto scroll-mt-24"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={container}
      >
        <motion.div variants={fadeUp} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-0)] p-8 shadow-xl">
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-extrabold text-[var(--text-0)]">Rooms: Listen together</motion.h2>
          <motion.p variants={fadeUp} className="mt-3 text-[var(--text-1)] max-w-3xl">
            Create shared rooms to listen with friends in real time. Queue tracks, vote on the next song, and keep the vibe flowing.
          </motion.p>
          <div className="mt-6 grid md:grid-cols-2 gap-6">
            {[{
              title: 'Real-time queue', desc: 'Everyone sees and controls the same queue — perfect for parties and study sessions.'
            }, {
              title: 'Invite easily', desc: 'Share a link and you’re in. No fuss, just music.'
            }].map((x, i) => (
              <motion.div key={i} variants={fadeUp} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-6">
                <div className="font-semibold text-[var(--text-0)]">{x.title}</div>
                <div className="text-[var(--text-1)] mt-2">{x.desc}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.section>

      {/* Playlists Advertisement */}
      <motion.section
        id="playlists"
        className="mt-16 max-w-6xl mx-auto scroll-mt-24"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={container}
      >
        <motion.div variants={fadeUp} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-0)] p-8 shadow-xl">
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-extrabold text-[var(--text-0)]">Playlists: Capture every mood</motion.h2>
          <motion.p variants={fadeUp} className="mt-3 text-[var(--text-1)] max-w-3xl">
            Save favorites, build mood-based mixes, and come back to them anytime. Your soundtrack, organized.
          </motion.p>
          <div className="mt-6 grid md:grid-cols-3 gap-6">
            {[
              { t: 'One-click like', d: 'Heart a track and it’s instantly saved to your Liked playlist.' },
              { t: 'Custom collections', d: 'Make as many playlists as you like — study, gym, chill, you name it.' },
              { t: 'Lightweight and fast', d: 'No clutter. Just quick access to what you love.' },
            ].map((x, i) => (
              <motion.div key={i} variants={fadeUp} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-6">
                <div className="font-semibold text-[var(--text-0)]">{x.t}</div>
                <div className="text-[var(--text-1)] mt-2">{x.d}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.section>

      {/* CTA */}
      <motion.section
        className="mt-20 text-center"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        variants={container}
      >
        <motion.div variants={fadeUp} className="text-2xl md:text-3xl font-semibold text-[var(--text-0)]">Start listening in seconds</motion.div>
        <motion.div variants={fadeUp} className="mt-4 text-[var(--text-1)]">Sign up or log in to dive into Moodcast.</motion.div>
        <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-4">
          <SignedOut>
            <SignUpButton mode="modal">
              <Button size="lg" className="px-8">Create account</Button>
            </SignUpButton>
            <SignInButton mode="modal">
              <Button size="lg" variant="outline" className="px-8">I already have an account</Button>
            </SignInButton>
          </SignedOut>
        </motion.div>
      </motion.section>
    </div>
  );
}
