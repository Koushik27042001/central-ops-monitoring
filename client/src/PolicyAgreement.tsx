import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PrivacyPolicyContent, TermsContent } from './PrivacyPolicy';

function AgreementDialog({accepted,onAccept,onClose}:{accepted:boolean;onAccept:()=>void;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const [checked,setChecked]=useState(accepted);
 const titleId=useId();
 useEffect(()=>{
  const opener=document.activeElement as HTMLElement | null;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  dialog.current?.showModal();
  const element=dialog.current;
  return ()=>{element?.close();document.body.style.overflow=previousOverflow;opener?.focus();};
 },[]);
 return createPortal(<dialog ref={dialog} className="policy-dialog" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onClose();}}>
  <header className="policy-dialog-heading"><h2 id={titleId}>Privacy Policy and Terms</h2><button type="button" className="secondary" aria-label="Close privacy policy and terms" onClick={onClose}>Close</button></header>
  <div className="policy-dialog-content" tabIndex={0} aria-label="Privacy policy and terms content"><h2>Privacy Policy</h2><PrivacyPolicyContent/><h2>Terms and Conditions</h2><TermsContent/></div>
  <form className="policy-dialog-actions" onSubmit={event=>{event.preventDefault();event.stopPropagation();if(checked)onAccept();}}>
   <label className="policy-dialog-agreement"><input type="checkbox" checked={checked} required onChange={event=>setChecked(event.target.checked)}/>I have read the Privacy Policy and agree to the Terms and Conditions.</label>
   <button type="submit" disabled={!checked}>Submit agreement</button>
  </form>
 </dialog>,document.body);
}

export function PolicyAgreement({accepted,onChange}:{accepted:boolean;onChange:(accepted:boolean)=>void}) {
 const [open,setOpen]=useState(false);
 const labelId=useId();
 return <>
  <div className="privacy-agreement"><input type="checkbox" checked={accepted} required aria-labelledby={labelId} onChange={event=>{if(event.target.checked)setOpen(true);else onChange(false);}}/><span id={labelId}>I have read and accept the <button type="button" className="policy-link" aria-haspopup="dialog" onClick={()=>setOpen(true)}>Privacy Policy and Terms and Conditions</button>.</span></div>
  {open&&<AgreementDialog accepted={accepted} onClose={()=>setOpen(false)} onAccept={()=>{onChange(true);setOpen(false);}}/>}
 </>;
}
