import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Compass } from 'lucide-react';
import { api } from './services/api';

const steps = [
 {page:'dashboard',title:'Welcome to your private workspace',text:'Your overview brings website health, open incidents, and response times together. Let’s take a quick look around.'},
 {page:'clients',title:'Start with your clients',text:'Add the people or businesses you work with. Keep their contact details and maintenance plans organized here.'},
 {page:'websites',title:'Connect your first website',text:'Add a website under a client, enter its URLs, and choose a monitoring interval. Use Add website when you’re ready.'},
 {page:'monitoring',title:'Keep an eye on uptime',text:'Review the latest status of your websites, open their check history, or request a fresh check. Results appear as the monitoring worker runs.'},
 {page:'api-endpoints',title:'Check your APIs',text:'Add GET or HEAD endpoints, choose an expected status, and set response assertions to check more than availability.'},
 {page:'incidents',title:'Follow up on failures',text:'Repeated monitoring failures open incidents. Review what happened and track each incident through resolution.'},
 {page:'notifications',title:'Catch important updates',text:'Find in-app monitoring and recovery notifications here. Mark updates as read as you work through them.'},
 {page:'integrations',title:'Connect a publishing destination',text:'Configure an authorized integration for a website and test its connection before publishing content to it.'},
 {page:'blogs',title:'Manage and publish content',text:'Create drafts for a client’s website, review publishing history, and publish now or schedule delivery through an integration.'},
 {page:'tickets',title:'Organize support requests',text:'Record support work by client and website. Set priorities and update each ticket as you make progress.'},
 {page:'maintenance',title:'Plan ongoing maintenance',text:'Keep scheduled updates and maintenance records in one place, with dates, descriptions, and progress.'},
 {page:'audit-logs',title:'Review your workspace activity',text:'Your audit log records actions in this workspace. You’re ready to begin—add a client and connect your first website.'},
];

export function WorkspaceTour({onFinish}:{onFinish:(status:'COMPLETED'|'SKIPPED')=>void}) {
 const [index,setIndex]=useState(0),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [rect,setRect]=useState<{left:number;top:number;width:number;height:number}|null>(null);
 const [position,setPosition]=useState({left:16,top:100});
 const dialog=useRef<HTMLDialogElement>(null),card=useRef<HTMLElement>(null);
 const titleId=useId(),descriptionId=useId(),maskId=useId().replaceAll(':','');
 const navigate=useNavigate(),location=useLocation();
 const step=steps[index]!;
 useEffect(()=>{
  const opener=document.activeElement as HTMLElement|null;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  dialog.current?.showModal();
  const element=dialog.current;
  return ()=>{element?.close();document.body.style.overflow=previousOverflow;opener?.focus();};
 },[]);
 useEffect(()=>{
  const path='/'+step.page;
  if(location.pathname!==path)navigate(path,{replace:true});
 },[step.page,location.pathname,navigate]);
 useEffect(()=>{
  let frame=0;
  const target=document.querySelector<HTMLElement>(`[data-tour="${step.page}"]`);
  target?.scrollIntoView({block:'nearest',inline:'center'});
  const measure=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    const bounds=target?.getBoundingClientRect();
    const width=Math.min(380,window.innerWidth-32),height=card.current?.getBoundingClientRect().height || 310;
    setRect(bounds?{left:bounds.left-5,top:bounds.top-5,width:bounds.width+10,height:bounds.height+10}:null);
    const left=bounds && bounds.right+width+24<window.innerWidth ? bounds.right+24 : Math.max(16,(window.innerWidth-width)/2);
    const top=bounds ? Math.min(Math.max(16,bounds.bottom+18),Math.max(16,window.innerHeight-height-16)) : Math.max(16,(window.innerHeight-height)/2);
    setPosition({left,top});
   });
  };
  measure();
  const observer=new ResizeObserver(measure);
  if(target)observer.observe(target);
  if(card.current)observer.observe(card.current);
  window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
  return ()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
 },[step.page,location.pathname]);
 useEffect(()=>{card.current?.querySelector<HTMLButtonElement>('[data-tour-next]')?.focus({preventScroll:true});},[index]);
 async function finish(status:'COMPLETED'|'SKIPPED'){
  setSaving(true);setError('');
  try{await api('auth/onboarding','PATCH',{status});onFinish(status);if(status==='COMPLETED')navigate('/clients');}
  catch(error){setError(error instanceof Error?error.message:'Unable to save the tour. Please try again.');}
  finally{setSaving(false);}
 }
 return createPortal(<dialog ref={dialog} className="workspace-tour" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event=>{event.preventDefault();if(!saving)void finish('SKIPPED');}}>
  <svg className="tour-shade" width="100%" height="100%" aria-hidden="true"><defs><mask id={maskId}><rect width="100%" height="100%" fill="white"/>{rect&&<rect x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="10" fill="black"/>}</mask></defs><rect width="100%" height="100%" fill="rgba(15,23,42,.68)" mask={`url(#${maskId})`}/></svg>
  {rect&&<div className="tour-highlight" style={rect} aria-hidden="true"/>}
  <section ref={card} className="tour-card" style={position}>
   <div className="tour-card-top"><span className="tour-icon"><Compass size={22}/></span><span className="eyebrow">YOUR WORKSPACE TOUR</span><button className="tour-skip" disabled={saving} onClick={()=>void finish('SKIPPED')}>Skip tour</button></div>
   <div className="tour-progress" role="progressbar" aria-label="Tour progress" aria-valuenow={index+1} aria-valuemin={1} aria-valuemax={steps.length}><span style={{width:((index+1)/steps.length*100)+'%'}}/></div>
   <div aria-live="polite"><h2 id={titleId}>{step.title}</h2><p id={descriptionId}>{step.text}</p></div>
   {error&&<div><p className="error" role="alert">{error}</p><button className="tour-skip" onClick={()=>onFinish('SKIPPED')}>Close for now</button></div>}
   <div className="tour-controls"><span className="tour-counter">{index+1} of {steps.length}</span>{index>0&&<button className="secondary" disabled={saving} onClick={()=>{setError('');setIndex(value=>value-1);}} aria-label="Previous tour step"><ArrowLeft size={16}/></button>}<button data-tour-next disabled={saving} onClick={()=>{setError('');if(index===steps.length-1)void finish('COMPLETED');else setIndex(value=>value+1);}}>{saving?'Saving…':index===steps.length-1?'Get started':'Next'}{index===steps.length-1?<Check size={16}/>:<ArrowRight size={16}/>}</button></div>
  </section>
 </dialog>,document.body);
}
