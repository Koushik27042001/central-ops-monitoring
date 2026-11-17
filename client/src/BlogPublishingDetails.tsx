import { useQuery } from '@tanstack/react-query';
import { api } from './services/api';

export function BlogPublishingDetails({blog,ownerId,onClose,onConfigure}:{blog:Record<string,any>;ownerId:string;onClose:()=>void;onConfigure:()=>void}) {
 const query=useQuery({queryKey:['blog-publishing',ownerId,blog._id],queryFn:async()=>{
  const [connection,jobs,revisions]=await Promise.all([api(`integrations/${blog.websiteId}/status`),api(`blogs/${blog._id}/publishing-history`),api(`blogs/${blog._id}/revisions`)]);
  return {connection:connection.data,jobs:jobs.data,revisions:revisions.data};
 },refetchInterval:5000});
 return <div className="modal-backdrop"><section className="panel modal" role="dialog" aria-modal="true" aria-label="Blog publishing details"><div className="panel-heading"><h2>{blog.title}: publishing</h2><button className="secondary" onClick={onClose}>Close</button></div><div className="api-response-content">
  {query.error&&<div className="error">{query.error.message}</div>}
  {query.isPending?<p>Loading publishing details…</p>:<>
   <p>Integration: {query.data?.connection?.isActive?'Configured':'Not configured'}. Last connection test: {query.data?.connection?.lastConnectedAt?new Date(query.data.connection.lastConnectedAt).toLocaleString():'Not verified'}.</p>
   <button className="secondary" onClick={onConfigure}>Configure website integration</button>
   <p>Publishing sends the saved post to this website. Editing and publishing it again updates the same integration-owned post. The worker must be running to deliver changes.</p>
   <h3>Publishing jobs</h3><div className="table-wrap"><table><thead><tr><th>Scheduled</th><th>Status</th><th>Attempts / result</th></tr></thead><tbody>{query.data?.jobs.map((job:Record<string,any>)=><tr key={job._id}><td>{new Date(job.scheduledAt).toLocaleString()}</td><td><span className={'badge '+job.status.toLowerCase()}>{job.status}</span></td><td>{job.attempts}<small>{job.lastError || (job.completedAt?'Delivered '+new Date(job.completedAt).toLocaleString():'Waiting for worker')}</small></td></tr>)}</tbody></table>{!query.data?.jobs.length&&<p>No publishing jobs yet.</p>}</div>
   <h3>Saved revisions</h3>{query.data?.revisions.map((revision:Record<string,any>)=><details key={revision._id}><summary>{new Date(revision.createdAt).toLocaleString()} — {revision.snapshot.title}</summary><p>Slug: {revision.snapshot.slug}</p><pre>{revision.snapshot.content}</pre></details>)}{!query.data?.revisions.length&&<p>No previous revisions. Editing a saved post creates a revision.</p>}
  </>}
 </div></section></div>;
}
