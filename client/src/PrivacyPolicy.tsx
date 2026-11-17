import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';

export function PrivacyPolicyContent() {
 return <>  <p>This notice describes how this workspace uses information when you sign in and manage monitoring services.</p>
  <section><h2>Account information</h2><p>Firebase Authentication handles email/password and Google authentication. The workspace uses your email address, account name, verification status, and authentication tokens to identify you and check workspace access. Google sign-in does not give this workspace access to your Gmail messages or Google Drive files.</p></section>
  <section><h2>Workspace information</h2><p>The application stores account records and operational information in MongoDB, including client and website details, monitoring results, support tickets, publishing records, and audit events. Each freelancer can access only their own workspace records. The installation operator controls database administration.</p></section>
  <section><h2>Sessions and browser storage</h2><p>Firebase uses browser storage to maintain your browser authentication. This workspace uses an HttpOnly session cookie for protected API requests, with a two-day lifetime by default. Local password authentication, when enabled, also uses a session cookie. You must sign in again after your workspace session expires. Signing out ends the current browser session; Firebase logout also revokes the account’s refresh tokens.</p></section>
  <section><h2>Services involved</h2><p>Authentication requests are processed by Google Firebase. Database records are stored in the configured MongoDB deployment. Monitoring and publishing send requests to the websites and integrations configured by workspace administrators.</p></section>
  <section><h2>Questions and account requests</h2><p>Contact your workspace administrator about access, correction, or removal of account and workspace information. Acknowledging this notice does not subscribe you to marketing messages.</p></section>
</>;
}
export function TermsContent() {
 return <>
  <section><h3>Your account and workspace</h3><p>Use accurate account information and keep your sign-in credentials secure. Each account has a private workspace. Do not attempt to access another person's account or workspace.</p></section>
  <section><h3>Authorized use</h3><p>Only monitor websites or publish content where you have permission. You are responsible for the client information, content, and integration credentials you add. Do not use the service to attack systems, collect data unlawfully, or bypass access controls.</p></section>
  <section><h3>Monitoring and availability</h3><p>Monitoring results reflect the checks the application completes. Network failures, hosting limits, and outages can delay checks or notifications. Review important incidents and keep independent backups of your work.</p></section>
  <section><h3>Open-source code and hosted service</h3><p>The application code is provided under the MIT license. Hosting availability and configured usage limits depend on the installation operator. Contact your workspace administrator with questions about this installation or your account.</p></section>
 </>;
}
export function PrivacyPolicy() {
 return <main className="privacy-page"><article className="panel privacy-policy"><Link className="login-brand" to="/" aria-label="OrbitOps home"><BrandLogo/></Link><h1>Privacy Policy</h1><PrivacyPolicyContent/><h2>Terms and Conditions</h2><TermsContent/><Link to="/dashboard" className="privacy-back">Back to sign in</Link></article></main>;
}
