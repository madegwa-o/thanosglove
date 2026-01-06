import React, { useEffect, useState, useRef } from 'react';

/**
 * NOTE: The import below will cause a 'Could not resolve' error in the 
 * browser preview because the file system is virtual. 
 * However, I am keeping it as per your requirement for your local codebase.
 */
import "../styles/RightContainer.css"

export default function RightContainer() {
  const [alphabet, setAlphabet] = useState("—");
  const [word, setWord] = useState("");

  // Throttling and Stability Refs
  const lastAppendTimeRef = useRef(0);
  const stabilityCounterRef = useRef(0);
  const lastDetectedLetterRef = useRef("");

  const APPEND_COOLDOWN = 1500; // 1.5 seconds cooldown
  const STABILITY_THRESHOLD = 5; // Must be detected 5 times consecutively

  useEffect(() => {
    const onSignDetected = (e) => {
      const letter = e.detail.alphabet;
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

  return (
    <div className="RightContainer">

      <span className="tech-label" style={{ padding: '0px', margin: '0px 0px 0px 5vw', color: "white" }}>Current Alphabet</span>
      <section className="first-viewport glass-panel">
        <h1 className='prdicted_letter'>{alphabet}</h1>
      </section>

      <span className="tech-label" style={{ padding: '0px', margin: '2vh 0px 0px 5vw', color: "white" }}>Spelling</span>
      <section className="second-viewport glass-panel">
        <span className='spelled_word' >{word}</span>
      </section>

      <section className="third-viewport ">
        <button className='tech-btn' onClick={() => { setWord(""); setAlphabet("—"); }}>🗑️ Clear</button>
        <button className='tech-btn' onClick={() => setWord(prev => prev.slice(0, -1))}>➡️ Undo</button>
        <button className='tech-btn tech-btn-primary' onClick={() => {
          const el = document.createElement('textarea');
          el.value = word;
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          document.body.removeChild(el);
        }}>🖇️ Copy</button>
      </section>

    </div>
  )
}