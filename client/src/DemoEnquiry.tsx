import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";
import { api } from "./services/api";

export function DemoEnquiry({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true); setError("");
    try {
      await api("demo-enquiries", "POST", Object.fromEntries(form.entries()));
      setSent(true);
    } catch (failure) { setError((failure as Error).message); }
    finally { setSending(false); }
  }
  return <dialog ref={dialog} className="home-demo-dialog" aria-labelledby="demo-title" aria-describedby={sent ? undefined : "demo-description"} onClose={onClose} onCancel={event => { if (sending) event.preventDefault(); }}>
    <button type="button" className="home-demo-close" aria-label="Close demo enquiry" disabled={sending} onClick={onClose}><X size={20}/></button>
    <div className="home-demo-content">
    {sent ? <div className="home-demo-success" role="status"><span><Check size={30}/></span><h2 id="demo-title">Request received.</h2><p>Your demo enquiry has been saved. Thank you for your interest in OrbitOps.</p><button className="home-button" type="button" onClick={onClose}>Back to homepage</button></div> : <>
      <span className="home-kicker">LET'S TALK ABOUT YOUR OPERATIONS</span>
      <h2 id="demo-title">Get an OrbitOps demo</h2>
      <p id="demo-description" className="home-demo-description">Tell us what you would like to monitor and how we can help.</p>
      <form className="home-demo-form" onSubmit={submit}>
        <label>Full name<input name="name" required minLength={2} maxLength={150} autoComplete="name" autoFocus placeholder="Your full name"/></label>
        <label>Email address<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@company.com"/></label>
        <label>Company <span>(optional)</span><input name="company" maxLength={150} autoComplete="organization" placeholder="Company or team name"/></label>
        <label>Website <span>(optional)</span><input name="website" type="url" maxLength={2000} placeholder="https://example.com"/></label>
        <label className="home-demo-wide">What would you like help with?<select name="interest" required defaultValue=""><option value="" disabled>Select an area of interest</option><option>Website monitoring</option><option>API health checks</option><option>Alerts and incidents</option><option>Full platform demo</option><option>Other enquiry</option></select></label>
        <label className="home-demo-wide">Your enquiry<textarea name="message" required minLength={10} maxLength={5000} rows={4} placeholder="Tell us about your websites, APIs, and monitoring needs."/></label>
        <p className="home-demo-wide home-demo-privacy">Your details will be used to review and respond to this enquiry. Please do not include passwords or API keys.</p>
        {error && <div className="error home-demo-wide" role="alert">{error}</div>}
        <button type="submit" className="home-button home-demo-wide" disabled={sending}>{sending ? "Sending enquiry..." : "Request a demo"}</button>
      </form>
    </>}
    </div>
  </dialog>;
}

