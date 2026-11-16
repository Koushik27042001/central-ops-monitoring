export type Assertion = {path: string; value?: string | number | boolean | null};
export function validateResponse(body: string, assertions: Assertion[]): string[] {
 let data: unknown;
 try {data = JSON.parse(body);} catch {return assertions.length ? ["Response is not valid JSON"] : [];}
 const failures: string[] = [];
 if (data && typeof data === "object" && "errors" in data && Array.isArray(data.errors) && data.errors.length) failures.push("GraphQL response contains errors");
 for (const assertion of assertions) {
  let value: unknown = data;
  for (const key of assertion.path.split(".")) {value = value && typeof value === "object" && Object.hasOwn(value, key) ? (value as Record<string, unknown>)[key] : undefined;}
  if (value === undefined) failures.push(assertion.path + " is missing");
  else if (Object.hasOwn(assertion, "value") && value !== assertion.value) failures.push(assertion.path + " does not match expected value");
 }
 return failures;
}
