import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({uid:'A',request:vi.fn(),dispatch:vi.fn()}));
vi.mock('../../client/src/services/firebase',()=>({
 firebaseEnabled:true,
 firebaseSession:async()=>({uid:state.uid,token:'test-token'}),
 firebaseAuth:()=>({currentUser:{uid:state.uid}}),
}));
vi.mock('axios',()=>({default:{create:()=>({request:state.request}),isAxiosError:(error:any)=>!!error.isAxiosError}}));
let api:(path:string)=>Promise<any>;
beforeEach(async()=>{
 state.uid='A';state.request.mockReset();state.dispatch.mockReset();
 vi.stubGlobal('window',{dispatchEvent:state.dispatch});
 const source=resolve(process.cwd(),'../client/src/services/api.ts');
 api=(await import(source)).api;
});
afterEach(()=>vi.unstubAllGlobals());
describe('browser responses stay with their authenticated account',()=>{
 it('accepts a response for the current account',async()=>{
  state.request.mockResolvedValue({data:{records:['A only']}});
  expect(await api('clients')).toEqual({records:['A only']});
  expect(state.request).toHaveBeenCalledWith(expect.objectContaining({headers:{'X-Account-Uid':'A'}}));
 });
 it('discards an old account response after switching accounts',async()=>{
  state.request.mockImplementation(async()=>{state.uid='B';return {data:{records:['A private record']}};});
  await expect(api('clients')).rejects.toThrow('response was discarded');
 });
 it('signals that an invalid session must clear private UI state',async()=>{
  state.request.mockRejectedValue({isAxiosError:true,response:{status:401,data:{error:{message:'Session expired'}}}});
  await expect(api('clients')).rejects.toThrow('Session expired');
  expect(state.dispatch).toHaveBeenCalledWith(expect.objectContaining({type:'orbitops:session-ended'}));
 });
 it('does not end the new account session because an old request failed',async()=>{
  state.request.mockImplementation(async()=>{state.uid='B';throw {isAxiosError:true,response:{status:401,data:{error:{message:'Expired A'}}}};});
  await expect(api('clients')).rejects.toThrow('Expired A');
  expect(state.dispatch).not.toHaveBeenCalled();
 });
});
