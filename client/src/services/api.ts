import { firebaseEnabled, firebaseSession, firebaseAuth } from "./firebase";
import axios from "axios";
const baseURL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '') + '/';
const http = axios.create({baseURL, withCredentials: true});
export async function api(path: string, method = "GET", body?: unknown) {
 let requestUid: string | undefined;
 try {
  const session = firebaseEnabled && !path.startsWith('health') && !path.startsWith('demo-enquiries') ? await firebaseSession() : undefined;
  requestUid=session?.uid;
  const response = await http.request({url: path, method, data: body, headers: session ? {'X-Account-Uid':session.uid} : undefined});
  if(session && firebaseAuth().currentUser?.uid !== session.uid) throw new Error('Your account changed. This response was discarded.');
  return response.data;
 }
 catch(error) {
  if (axios.isAxiosError(error)) {
   const detail = error.response?.data?.error;
   const sameAccount=!requestUid || firebaseAuth().currentUser?.uid===requestUid;
   if((error.response?.status === 401 || detail?.code === 'FORBIDDEN') && (!firebaseEnabled || sameAccount)) window.dispatchEvent(new Event('orbitops:session-ended'));
   throw new Error(detail?.details?.map((item: {path: string[]; message: string}) => item.path.join('.') + ': ' + item.message).join('; ') || detail?.message || 'Unable to reach the API. Check that the backend is running.');
  }
  throw error;
 }
}
