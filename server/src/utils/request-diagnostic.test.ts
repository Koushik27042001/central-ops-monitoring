import { describe, expect, it } from 'vitest';
import { requestDiagnostic } from './request-diagnostic.js';
import { formatTerminalLog } from './terminal-log.js';

describe('request failure diagnostics',()=>{
 it('preserves the save stage and database code in text logs without private error details',()=>{
  const diagnostic=requestDiagnostic({name:'MongoServerError',code:13,message:'password=private',stack:'secret stack'},'websites:sync-monitoring','test-reference');
  const output=formatTerminalLog({level:50,msg:'A request could not be completed.',diagnostic});
  expect(output).toContain('reference=test-reference stage=websites:sync-monitoring error=MongoServerError databaseCode=13');
  expect(output).not.toContain('private');expect(output).not.toContain('secret stack');
 });
 it('does not echo arbitrary error names or codes',()=>{
  expect(requestDiagnostic({name:'secret name',code:'secret code'},'request','reference')).toBe('reference=reference stage=request error=UnknownError');
  expect(requestDiagnostic(null,'request','reference')).toContain('error=UnknownError');
 });
});
