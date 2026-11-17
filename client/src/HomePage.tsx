import { BrandLogo } from "./BrandLogo";
import { useState } from "react";
import { DemoEnquiry } from "./DemoEnquiry";
import { Link } from "react-router-dom";
import { Activity, ArrowDown, ArrowRight, Bell, Check, ChevronRight, Globe, Radio, Server, ShieldCheck } from "lucide-react";
import heroIllustration from "../assets/illustrater_image/OrbitOps Monitoring Dashboard.png";
import workflowIllustration from "../assets/illustrater_image/OrbitOps Dashboard Monitoring Illustration.png";
import "./HomePage.css";

const features = [
  { icon: Globe, number: "01", title: "Website Monitoring", description: "Keep an eye on every website. Track availability, response times, and uptime trends from your private workspace.", detail: "Your websites, in clear view", className: "websites" },
  { icon: Server, number: "02", title: "API Health Checks", description: "Look beyond the homepage. Check backend endpoints, expected status codes, and the responses your services return.", detail: "Confidence beyond the frontend", className: "apis" },
  { icon: Bell, number: "03", title: "Smart Alerts", description: "Turn repeated failures into actionable incidents. Review failure notifications and know when a service recovers.", detail: "See the issue. Take the next step.", className: "alerts" },
];

export function HomePage() {
  const [demoOpen, setDemoOpen] = useState(false);
  return <div className="orbit-home">
    <a className="home-skip" href="#home-main">Skip to content</a>
    <header className="home-header">
      <Link className="home-wordmark" to="/" aria-label="OrbitOps home"><BrandLogo/></Link>
      <nav aria-label="Homepage navigation" className="home-nav"><Link to="/features">Features</Link><a href="#how-it-works">How it works</a><Link to="/login">Login <ChevronRight size={14}/></Link></nav>
      <button type="button" className="home-button home-button-small home-demo-trigger" onClick={() => setDemoOpen(true)}>Get Demo <ArrowRight size={15}/></button>
    </header>
    <main id="home-main">
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="home-hero-copy"><span className="home-kicker"><span/> A CLEARER VIEW OF YOUR DIGITAL WORLD</span>
          <h1 id="hero-title">Every Website.<br/>One <span>Command<br className="home-desktop-break"/> Center.</span></h1>
          <p className="home-lead">Monitor uptime, API health, and performance from one powerful dashboard. Less switching tabs. More staying ahead.</p>
          <div className="home-actions"><Link className="home-button" to="/dashboard">Get Started <ArrowRight size={18}/></Link><Link className="home-button home-button-outline" to="/features">Explore Features <ArrowDown size={16}/></Link></div>
          <div className="home-hero-notes"><span><ShieldCheck size={16}/> Private freelancer workspace</span><span><Check size={16}/> Websites + APIs, together</span></div>
        </div>
        <div className="home-hero-visual"><div className="home-visual-heading"><span><Radio size={14}/> YOUR OPERATIONS. CONNECTED.</span><span className="home-mini-dots"><i/><i/><i/></span></div><img src={heroIllustration} alt="OrbitOps monitoring illustration connecting websites, servers, APIs, and alerts to one dashboard" width={1754} height={897} fetchPriority="high"/><div className="home-visual-footer"><span><span className="home-status-dot"/> One workspace. Every signal.</span><span>Product illustration</span></div></div>
        <div className="home-signal-strip"><span className="home-strip-title">BUILT FOR THE BIG PICTURE</span><span><Globe size={17}/> Website availability</span><span><Server size={17}/> API health</span><span><Activity size={17}/> Performance insights</span><span><Bell size={17}/> Incident visibility</span></div>
      </section>
      <section className="home-features home-section" id="features" aria-labelledby="features-title"><div className="home-section-heading"><div><span className="home-kicker">01 / THE ESSENTIALS, TOGETHER</span><h2 id="features-title">Everything You Need<br/>to <span>Stay Online.</span></h2></div><p>Your operations deserve a clear view.<br/>Bring the signals that matter into focus.</p></div>
        <div className="home-feature-grid">{features.map(({icon:Icon,...feature})=><article className={'home-feature '+feature.className} key={feature.title}><div className="home-feature-top"><span className="home-feature-icon"><Icon size={25}/></span><span>{feature.number}</span></div><h3>{feature.title}</h3><p>{feature.description}</p><div className="home-feature-detail"><span/>{feature.detail}</div></article>)}</div>
      </section>
      <section className="home-workflow home-section" id="how-it-works" aria-labelledby="workflow-title"><div className="home-workflow-visual"><div className="home-workflow-tag"><Activity size={16}/> From URL to useful insight</div><img src={workflowIllustration} alt="Illustration of an OrbitOps laptop dashboard showing website availability and API monitoring" width={1752} height={897} loading="lazy"/><p>Illustrative dashboard. Your workspace shows your actual monitoring results.</p></div><div className="home-workflow-copy"><span className="home-kicker">02 / A SIMPLE WAY TO START</span><h2 id="workflow-title">Connect. Monitor.<br/><span>Stay Ahead.</span></h2><p>From your first website to your everyday operations, keep everything in one place.</p><ol className="home-steps"><li><span>01</span><div><h3>Register your website</h3><p>Sign in, add a client, and register the website you want to keep track of.</p></div></li><li><span>02</span><div><h3>Connect your backend or API</h3><p>Add your Render backend, health endpoint, or API URL and choose what a healthy response looks like.</p></div></li><li><span>03</span><div><h3>See your monitoring results</h3><p>Enable monitoring and review uptime, response times, and incidents as checks run.</p></div></li></ol><Link className="home-inline-link" to="/dashboard">Go to your command center <ArrowRight size={17}/></Link></div></section>
      <section className="home-cta home-section" aria-labelledby="cta-title"><div className="home-cta-orbit" aria-hidden="true"/><div><span className="home-kicker">LESS COMPLEXITY. MORE CLARITY.</span><h2 id="cta-title">Your Digital Operations,<br/><span>Simplified.</span></h2><p>Bring all your websites, APIs, and alerts together.</p></div><div className="home-cta-action"><Link className="home-button" to="/dashboard">Open Dashboard <ArrowRight size={19}/></Link><span>Your next clear view starts here.</span></div></section>
    </main>
    <footer className="home-footer"><Link className="home-wordmark" to="/"><BrandLogo/></Link><p>Copyright &copy; {new Date().getFullYear()} OrbitOps. MIT licensed code.</p><a href="#home-main">Back to top</a></footer>
    {demoOpen && <DemoEnquiry onClose={() => setDemoOpen(false)}/>}
  </div>;
}
