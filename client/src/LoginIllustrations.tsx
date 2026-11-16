import { useEffect, useState } from "react";
import unifiedDashboard from "../assets/illustrater_image/OrbitOps Unified Monitoring Dashboard.png";
import realtimeDashboard from "../assets/illustrater_image/OrbitOps Real-Time Monitoring Dashboard.png";

const slides = [
  { src: unifiedDashboard, alt: "OrbitOps unified monitoring for website health, API performance, and system uptime" },
  { src: realtimeDashboard, alt: "OrbitOps real-time monitoring dashboard" },
];

export function LoginIllustrations() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (paused || hovered || focused || reducedMotion) return;
    const timer = window.setInterval(() => setActive(current => (current + 1) % slides.length), 5000);
    return () => window.clearInterval(timer);
  }, [paused, hovered, focused, reducedMotion]);
  return <section className="login-illustrations" aria-label="OrbitOps monitoring highlights" aria-roledescription="carousel"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="login-slides-window">
      <div className="login-slides-track" style={{ transform: 'translateX(-' + active * 100 + '%)' }}>
        {slides.map((slide, index) => <div className="login-slide" key={slide.src} aria-hidden={index !== active}>
          <img src={slide.src} alt={slide.alt} width={1536} height={1024} decoding="async" />
        </div>)}
      </div>
    </div>
    <div className="login-slide-controls">
      <div className="login-slide-dots" aria-label="Choose illustration">
        {slides.map((slide, index) => <button key={slide.src} type="button" className="login-slide-dot" aria-label={"Show illustration " + (index + 1)} aria-pressed={active === index} onClick={() => setActive(index)} />)}
      </div>
      {!reducedMotion && <button type="button" className="login-slide-pause" onClick={() => setPaused(current => !current)}>{paused ? "Play slideshow" : "Pause slideshow"}</button>}
    </div>
  </section>;
}
