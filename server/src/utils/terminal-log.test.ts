import { describe, expect, it } from 'vitest';
import { formatTerminalLog } from './terminal-log.js';

describe('readable terminal status messages',()=>{
 it('keeps status, service and message columns aligned',()=>{
  const ok=formatTerminalLog({time:0,level:30,area:'Database',msg:'Connected.'});
  const failure=formatTerminalLog({time:0,level:60,area:'Website service',msg:'Could not start.'});
  expect(ok.indexOf('Connected.')).toBe(failure.indexOf('Could not start.'));
  expect(ok).toContain('OK');expect(failure).toContain('STOPPED');
 });
 it('shows an actionable next step without raw errors or private metadata',()=>{
  const record={time:0,level:50,area:'Database',msg:'Could not connect.',hint:'Check the database settings.',err:{message:'secret-password',stack:'private-stack'},req:{headers:{authorization:'private-token'}},FIREBASE_PRIVATE_KEY:'private-key'};
  const text=formatTerminalLog(record);
  expect(text).toContain('Next step: Check the database settings.');
  for(const value of ['secret-password','private-stack','private-token','private-key','hostname','pid'])expect(text).not.toContain(value);
 });
 it('prevents log text from injecting extra status lines',()=>{
  const text=formatTerminalLog({level:40,area:'Database\nFAKE',msg:'Check\r\nyour settings.'});
  expect(text.trim().split('\n')).toHaveLength(1);
 });
});
