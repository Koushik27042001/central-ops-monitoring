// Fixed error categories and numeric database codes are safe to show in hosting
// logs. Driver messages, stacks and rejected values can contain private data.
export function requestDiagnostic(error: unknown, stage: string, reference: string): string {
 const item = error && typeof error === 'object' ? error as {name?:unknown;code?:unknown} : {};
 const names = new Set(['MongoServerError','MongoNetworkError','MongoServerSelectionError','ValidationError','CastError','StrictModeError','TypeError','ReferenceError','Error']);
 const name = typeof item.name === 'string' && names.has(item.name) ? item.name : 'UnknownError';
 const code = typeof item.code === 'number' && Number.isSafeInteger(item.code) ? ` databaseCode=${item.code}` : '';
 return `reference=${reference} stage=${stage} error=${name}${code}`;
}
