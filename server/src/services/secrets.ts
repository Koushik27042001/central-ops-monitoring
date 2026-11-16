import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env.js";
function key() {if (!env.INTEGRATION_ENCRYPTION_KEY) throw new Error("Configure INTEGRATION_ENCRYPTION_KEY before managing integrations"); return Buffer.from(env.INTEGRATION_ENCRYPTION_KEY, "hex");}
export function encryptSecret(value: string) {const nonce=randomBytes(12); const cipher=createCipheriv('aes-256-gcm',key(),nonce); const body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]); return [nonce.toString('hex'),cipher.getAuthTag().toString('hex'),body.toString('hex')].join('.');}
export function decryptSecret(value: string) {const [nonce,tag,body]=value.split('.');if(!nonce||!tag||!body)throw new Error('Invalid encrypted credential'); const cipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(nonce,'hex'));cipher.setAuthTag(Buffer.from(tag,'hex'));return Buffer.concat([cipher.update(Buffer.from(body,'hex')),cipher.final()]).toString('utf8');}
