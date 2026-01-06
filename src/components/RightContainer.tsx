'use client'

import React, { useEffect, useState, useRef } from 'react';

interface SignLanguageEvent extends Event {
  detail: {
    alphabet: string;
  };
}

export default function RightContainer() {
  const [alphabet, setAlphabet] = useState<string>("—");
  const [word, setWord] = useState<string>("");

  // Throttling and Stability Refs
  const lastAppendTimeRef = useRef<number>(0);
  const stabilityCounterRef = useRef<number>(0);
  const lastDetectedLetterRef = useRef<string>("");

  const APPEND_COOLDOWN = 1500; // 1.5 seconds cooldown
  const STABILITY_THRESHOLD = 5; // Must be detected 5 times consecutively

  useEffect(() => {
    const onSignDetected = (e: Event) => {
      const event = e as SignLanguageEvent;
      const letter = event.detail.alphabet;
      const now = Date.now();

      // Always update the HUD immediately
      setAlphabet(letter);

      // Throttling and Stability Logic
      if (letter !== "—") {
        if (letter === lastDetectedLetterRef.current) {
          stabilityCounterRef.current += 1;
        } else {
          stabilityCounterRef.current = 0;
          lastDetectedLetterRef.current = letter;
        }

        if (
            stabilityCounterRef.current >= STABILITY_THRESHOLD &&
            (now - lastAppendTimeRef.current > APPEND_COOLDOWN)
        ) {
          setWord((prevWord) => prevWord + letter);
          lastAppendTimeRef.current = now;
          stabilityCounterRef.current = 0;
        }
      } else {
        stabilityCounterRef.current = 0;
        lastDetectedLetterRef.current = "";
      }
    };

    window.addEventListener('signLanguageDetected', onSignDetected);
    return () => window.removeEventListener('signLanguageDetected', onSignDetected);
  }, []);

  const handleCopy = async () => {
    try {
      // Modern clipboard API (preferred)
      await navigator.clipboard.writeText(word);
    } catch (err) {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = word;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  };

  return (
      <div className="w-full flex flex-col">
        {/* Current Alphabet Section */}
        <span className="text-white text-xs tracking-wider uppercase opacity-70 ml-4 mb-2">
        Current Alphabet
      </span>
        <section className="w-full min-h-[200px] rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/10 backdrop-blur-sm flex items-center justify-center mb-6">
          <h1 className="text-8xl font-bold text-white tracking-wider">
            {alphabet}
          </h1>
        </section>

        {/* Spelling Section */}
        <span className="text-white text-xs tracking-wider uppercase opacity-70 ml-4 mb-2 mt-4">
        Spelling
      </span>
        <section className="w-full min-h-[120px] rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/10 backdrop-blur-sm flex items-center justify-center p-6 mb-6">
        <span className="text-3xl font-semibold text-white tracking-wide break-all text-center">
          {word || "—"}
        </span>
        </section>

        {/* Action Buttons */}
        <section className="w-full flex gap-3 justify-center">
          <button
              className="px-6 py-3 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all duration-200 font-medium text-sm tracking-wide"
              onClick={() => {
                setWord("");
                setAlphabet("—");
              }}
          >
            🗑️ Clear
          </button>
          <button
              className="px-6 py-3 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all duration-200 font-medium text-sm tracking-wide"
              onClick={() => setWord(prev => prev.slice(0, -1))}
          >
            ⬅️ Undo
          </button>
          <button
              className="px-6 py-3 rounded-lg bg-indigo-600 border border-indigo-500 text-white hover:bg-indigo-700 transition-all duration-200 font-medium text-sm tracking-wide"
              onClick={handleCopy}
          >
            📋 Copy
          </button>
        </section>
      </div>
  );
}