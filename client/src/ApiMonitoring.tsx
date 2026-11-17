import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './services/api';

type RecordRow = Record<string, any>;
const statusBadge=(status:string)=><span className={'badge '+status.toLowerCase()}><i/>{status}</span>;
export function ApiMonitoring({sites,ownerId,onEdit}:{sites:RecordRow[];ownerId:string;onEdit:(row:RecordRow)=>void}) {
 const [search,setSearch]=useState(''),[websiteId,setWebsiteId]=useState(''),[page,setPage]=useState(1);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<RecordRow|null>(null),[history,setHistory]=useState<RecordRow[]|null>(null);
 const query=useQuery({queryKey:['api-console',ownerId,page,search,websiteId],queryFn:()=>api(`api-endpoints?page=${page}&limit=20&search=${encodeURIComponent(search)}${websiteId?'&websiteId='+websiteId:''}`),refetchInterval:10000});
 const rows:RecordRow[]=query.data?.data ?? [];
 async function run(row:RecordRow){
  const response=await api(`api-endpoints/${row._id}/test`,'POST');
  return {...response.data,name:row.name,url:row.url,configurationChanged:response.configurationChanged};
 }
 async function test(row:RecordRow){setBusy(true);setError('');try{setResult(await run(row));await query.refetch();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function testPage(){
  setBusy(true);setError('');
  const failures:string[]=[];let next=0;
  await Promise.all(Array.from({length:Math.min(3,rows.length)},async()=>{
   while(next<rows.length){const row=rows[next++];try{await run(row);}catch(e){failures.push(`${row.name}: ${(e as Error).message}`);}}
  }));
  await query.refetch();setBusy(false);if(failures.length)setError(failures.join('; '));
 }
 const counts=['UP','DOWN','UNKNOWN','STALE','PAUSED'];
 return <section className="api-console">
  <div className="metrics">{counts.map(status=><article className="panel metric" key={status}>{statusBadge(status)}<strong>{rows.filter(row=>row.status===status).length}</strong><small>On this page</small></article>)}</div>
  <div className="toolbar api-console-toolbar"><label>Search endpoints<input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Name"/></label><label>Website<select value={websiteId} onChange={e=>{setWebsiteId(e.target.value);setPage(1);}}><option value="">All websites</option>{sites.map(site=><option key={site._id} value={site._id}>{site.name}</option>)}</select></label><button disabled={busy||!rows.length} onClick={()=>void testPage()}>{busy?'Testing…':'Test this page'}</button><button className="secondary" disabled={busy} onClick={()=>void query.refetch()}>Refresh results</button></div>
  <p className="notice">Test now sends a GET or HEAD request immediately. Scheduled monitoring runs separately. Response previews are limited to 8,192 characters and saved in your private check history for up to 30 days. Register each API URL you want to test.</p>
  {(error||query.error)&&<div className="error" role="alert">{error||query.error?.message}</div>}
  <div className="panel table-wrap"><table><thead><tr><th>Endpoint / website</th><th>Health</th><th>HTTP / timing</th><th>Last checked</th><th>Actions</th></tr></thead><tbody>{rows.map(row=><tr key={row._id}><td><strong>{row.name}</strong><small>{sites.find(site=>site._id===row.websiteId)?.name}</small><small>{row.method} {row.url}</small><small>Expected HTTP {row.expectedStatus} · {row.isActive?'Monitoring enabled':'Monitoring paused'}</small></td><td>{statusBadge(row.status)}{row.status==='STALE'&&<small>Scheduled checks are overdue</small>}</td><td>{row.lastCheck?<>HTTP {row.lastCheck.httpStatus ?? 'no response'}<small>{row.lastCheck.responseTime == null?'No timing':row.lastCheck.responseTime+' ms'}</small><small>{row.lastCheck.errorMessage}</small></>:'Not tested'}</td><td>{row.lastCheck?new Date(row.lastCheck.checkedAt).toLocaleString():'—'}</td><td className="row-actions"><button disabled={busy} onClick={()=>void test(row)}>Test now</button><button className="secondary" disabled={busy} onClick={()=>onEdit(row)}>Edit</button><button className="text-button" disabled={busy} onClick={async()=>{setError('');try{setHistory((await api(`api-endpoints/${row._id}/history`)).data);}catch(e){setError((e as Error).message);}}}>History</button></td></tr>)}</tbody></table>{query.isPending?<div className="empty">Loading endpoints…</div>:!rows.length&&<div className="empty">Add an endpoint to start testing.</div>}</div>
  <div className="pagination"><button className="secondary" disabled={busy||page===1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page} · {query.data?.pagination.total ?? 0} endpoints</span><button className="secondary" disabled={busy||page*20>=(query.data?.pagination.total ?? 0)} onClick={()=>setPage(page+1)}>Next</button></div>
  {history&&<div className="modal-backdrop"><section className="panel modal" role="dialog" aria-modal="true" aria-label="API test history"><div className="panel-heading"><h2>API test history</h2><button className="secondary" onClick={()=>setHistory(null)}>Close</button></div><div className="table-wrap"><table><thead><tr><th>Checked</th><th>Health</th><th>HTTP / timing</th><th>Response</th></tr></thead><tbody>{history.map(check=><tr key={check._id}><td>{new Date(check.checkedAt).toLocaleString()}</td><td>{statusBadge(check.status)}</td><td>{check.httpStatus ?? 'No response'}<small>{check.responseTime == null?'No timing':check.responseTime+' ms'}</small></td><td><button className="text-button" onClick={()=>setResult(check)}>Inspect</button></td></tr>)}</tbody></table>{!history.length&&<div className="empty">No recorded checks.</div>}</div></section></div>}
  {result&&<div className="modal-backdrop"><section className="panel modal api-test-result" role="dialog" aria-modal="true" aria-label="API response"><div className="panel-heading"><h2>{result.name||'API response'}</h2><button className="secondary" onClick={()=>setResult(null)}>Close</button></div><div className="api-response-content">{statusBadge(result.status)}<p>{result.url}</p><p>HTTP {result.httpStatus ?? 'no response'} · {result.responseTime == null?'No timing':result.responseTime+' ms'} · {new Date(result.checkedAt).toLocaleString()}</p>{result.errorMessage&&<div className="error">{result.errorMessage}</div>}{result.configurationChanged&&<div className="notice">Configuration changed during the test. This result was not saved; test the latest configuration again.</div>}<h3>Response body</h3><pre>{result.responsePreview ?? 'No response preview was saved for this check.'}</pre>{result.responsePreview===''&&<p>No response body returned.</p>}{result.responseTruncated&&<small>Preview truncated to 8,192 characters.</small>}</div></section></div>}
 </section>;
}
