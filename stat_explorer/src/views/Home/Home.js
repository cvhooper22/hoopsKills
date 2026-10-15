import React, { useState, useEffect } from 'react';
import "./Home.css";

const SLIDES = [
  {
    title: 'Lineups',
    image: 'lineups.png',
    description: "Look at each game's lineup, filter by players, and view statistics on how long each lineup played and when.",
    href: '/lineups/season',
    cta: 'Go to Lineups',
  },
  {
    title: 'Kills',
    image: 'kills.png',
    description: "Track defensive stops and kills (three stops in a row), game by game and across the season.",
    href: '/kills/season',
    cta: 'Go to Kills',
  },
  {
    title: 'Clutch',
    image: 'clutch.png',
    description: "See who performs when the game is on the line with clutch-time stats for every game and the full season.",
    href: '/clutch/season',
    cta: 'Go to Clutch',
  },
  {
    title: 'Alumni',
    image: 'alumni.png',
    description: "Catch up on where recent BYU Basketball Alumni are currently playing in the pros.",
    href: '/alumni',
    cta: 'Check it out',
  },
];

const AUTOPLAY_MS = 7000;

export default function Home () {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = (i) => setIndex((i + SLIDES.length) % SLIDES.length);

  useEffect(() => {
    if (paused) return undefined;
    const id = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [index, paused]);

  return (
    <div className="home flex-c scroll">
      <div
        className="carousel"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {SLIDES.map((slide, i) => (
          <div
            key={slide.title}
            className={`carousel-slide${i === index ? ' carousel-slide--active' : ''}`}
            aria-hidden={i !== index}
          >
            <img className="carousel-image" src={slide.image} alt={`Screenshot of ${slide.title} page`} />
            <div className="carousel-caption">
              <h2>{slide.title}</h2>
              <p>{slide.description}</p>
              <a href={slide.href} className="carousel-link" tabIndex={i === index ? 0 : -1}>
                {slide.cta}
              </a>
            </div>
          </div>
        ))}
        <button className="carousel-arrow carousel-arrow--prev" onClick={() => go(index - 1)} aria-label="Previous"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        <button className="carousel-arrow carousel-arrow--next" onClick={() => go(index + 1)} aria-label="Next"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        <div className="carousel-dots">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.title}
              className={`carousel-dot${i === index ? ' carousel-dot--active' : ''}`}
              onClick={() => go(i)}
              aria-label={`Show ${slide.title}`}
            />
          ))}
        </div>
      </div>
      <div className="feature-list">
        {SLIDES.map((slide) => (
          <div key={slide.title} className="feature-area">
            <img className="home-image" src={slide.image} alt={`Screenshot of ${slide.title} page`} />
            <div className="home-description">
              <h2>{slide.title}</h2>
              {slide.description}
              <a href={slide.href} className="home-link">
                {slide.cta}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
