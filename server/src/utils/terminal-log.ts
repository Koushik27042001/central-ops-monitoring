type LogRecord={time?:number;level?:number;msg?:string;area?:string;hint?:string;port?:number};
const clean=(value:string)=>value.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim();
export function formatTerminalLog(record:LogRecord):string {
 const time=new Date(record.time ?? Date.now()).toLocaleTimeString('en-GB',{hour12:false});
 const status=(record.level ?? 30)>=60?'STOPPED':(record.level ?? 30)>=50?'ERROR':(record.level ?? 30)>=40?'NOTICE':(record.level ?? 30)<30?'DETAIL':'OK';
 const area=clean(record.area || 'Platform').slice(0,20).padEnd(20);
 let line=`${time}  ${status.padEnd(8)}  ${area}  ${clean(record.msg || 'Status updated')}`;
 if(record.hint)line+=`\n${' '.repeat(42)}Next step: ${clean(record.hint)}`;
 return line+'\n';
}

// Pino redacts sensitive fields before handing records to this destination.
// Only explicitly chosen display fields are printed, never raw errors or headers.
export const terminalDestination={write(chunk:string){
 for(const line of chunk.split('\n').filter(Boolean)){
  try{process.stdout.write(formatTerminalLog(JSON.parse(line) as LogRecord));}
  catch{process.stdout.write('NOTICE    A status message could not be displayed.\n');}
 }
}};
