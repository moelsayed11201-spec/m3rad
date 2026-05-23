import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase environment variables
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

// Determine if Supabase is fully configured
export const isSupabaseConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY' &&
  typeof supabaseUrl === 'string' &&
  (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'));

// Initialize live Supabase client if configured, otherwise null
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Initialize custom console logs to inform developers of the current runtime configuration
console.log(
  isSupabaseConfigured
    ? '[Supabase Service] Live Supabase client initialized and connected.'
    : '[Supabase Service] Run in local fallback mode (Offline client-side localStorage).'
);

// === Interfaces for our Shim layer ===
export interface DocRef {
  type: 'doc';
  collectionName: string;
  id: string;
}

export interface CollectionRef {
  type: 'collection';
  collectionName: string;
}

export interface QueryRef {
  type: 'query';
  collectionName: string;
  filters: any[];
  limitVal?: number;
}

// === Type mappings ===
export type Database = any;
export const db = 'supabase-db-instance';

// === Storage Cache for Sandbox / Offline Fallback Mode ===
const LOCAL_STORAGE_DB_PREFIX = 'qeist_erp_local_db_';

function getLocalTable(tableName: string): any[] {
  try {
    const rawData = localStorage.getItem(`${LOCAL_STORAGE_DB_PREFIX}${tableName}`);
    return rawData ? JSON.parse(rawData) : [];
  } catch (e) {
    console.warn(`[Local Fallback] Error reading table ${tableName} from localStorage:`, e);
    return [];
  }
}

function saveLocalTable(tableName: string, data: any[]) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_DB_PREFIX}${tableName}`, JSON.stringify(data));
  } catch (e) {
    console.error(`[Local Fallback] Error writing table ${tableName} to localStorage:`, e);
  }
}

function getLocalDoc(tableName: string, docId: string): any | null {
  const table = getLocalTable(tableName);
  return table.find((item: any) => item.id === docId) || null;
}

function saveLocalDoc(tableName: string, docId: string, data: any) {
  const table = getLocalTable(tableName);
  const index = table.findIndex((item: any) => item.id === docId);
  const updatedItem = { ...data, id: docId };
  
  if (index !== -1) {
    table[index] = { ...table[index], ...updatedItem };
  } else {
    table.push(updatedItem);
  }
  saveLocalTable(tableName, table);
}

// Initialize settings and branches in case the client runs offline initially
if (!localStorage.getItem(`${LOCAL_STORAGE_DB_PREFIX}settings`)) {
  localStorage.setItem(`${LOCAL_STORAGE_DB_PREFIX}settings`, JSON.stringify([
    { id: 'companyName', value: 'سلسلة كويست للتجارة' },
    { id: 'vatRate', value: '15' },
    { id: 'currency', value: 'SAR' }
  ]));
}
if (!localStorage.getItem(`${LOCAL_STORAGE_DB_PREFIX}branches`)) {
  localStorage.setItem(`${LOCAL_STORAGE_DB_PREFIX}branches`, JSON.stringify([
    {
      id: 'default-branch',
      name: 'فرع الإدارة الرئيسي',
      address: 'الرياض - الملز',
      phone: '0500000001',
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: 'system-bootstrap'
    }
  ]));
}

// === Reactive Subscription System for Auth ===
interface MockUser {
  uid: string;
  email: string;
  role?: string;
  name?: string;
}

let activeMockUser: MockUser | null = (() => {
  try {
    const session = localStorage.getItem('qeist_auth_session');
    return session ? JSON.parse(session) : null;
  } catch (_) {
    return null;
  }
})();

const authStateListeners: Set<(user: any) => void> = new Set();

function notifyAuthListeners() {
  const user = auth.currentUser;
  authStateListeners.forEach((listener) => {
    try {
      listener(user);
    } catch (e) {
      console.error('[Supabase Auth Listener] Error in subscriber:', e);
    }
  });
}

// Initialize Supabase Auth state synchronization if live
if (supabase) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('[Supabase Auth] Session changed event:', event);
    notifyAuthListeners();
  });
}

// === Authentication Exports ===
export const auth = {
  get currentUser() {
    if (supabase && isSupabaseConfigured) {
      // Find the active Supabase authentication session
      try {
        const user = localStorage.getItem('sb-access-token'); // Check local Supabase storage sync
      } catch (_) {}
      
      // Attempt manual retrieve of user session if defined
      const sbSessionUser = (window as any).__sb_user_cache;
      if (sbSessionUser) return sbSessionUser;
    }
    
    // Default to active mock user if unconfigured or fallback
    return activeMockUser ? {
      uid: activeMockUser.uid,
      email: activeMockUser.email,
      ...activeMockUser
    } : null;
  },
  signOut: async () => {
    localStorage.removeItem('qeist_auth_session');
    activeMockUser = null;
    (window as any).__sb_user_cache = null;

    if (supabase && isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('[Supabase Auth] error during signout:', err);
      }
    }
    notifyAuthListeners();
  }
};

export function onAuthStateChanged(authInstance: any, callback: (user: any) => void) {
  authStateListeners.add(callback);
  // Trigger initial callback
  callback(auth.currentUser);
  return () => {
    authStateListeners.delete(callback);
  };
}

export async function signInWithEmailAndPassword(authInstance: any, email: string, pass: string) {
  const trimmedEmail = email.trim();
  
  if (supabase && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: pass
      });
      if (error) throw error;
      
      // Cache the session user
      if (data?.user) {
        const payload: MockUser = {
          uid: data.user.id,
          email: data.user.email || trimmedEmail
        };
        (window as any).__sb_user_cache = payload;
        activeMockUser = payload;
        localStorage.setItem('qeist_auth_session', JSON.stringify(payload));
        notifyAuthListeners();
        return { user: payload };
      }
    } catch (err: any) {
      console.warn('[Supabase Auth] Live sign-in failed. Falling back to offline authentication:', err.message);
      // Fallback below
    }
  }

  // Local Offline fallback authentication
  const normalizedEmail = trimmedEmail.toLowerCase();
  
  // Find user by email in the local "users" table
  const localUsersList = getLocalTable('users');
  const matchedUser = localUsersList.find((u: any) => u.email?.toLowerCase() === normalizedEmail);

  if (matchedUser) {
    const payload: MockUser = {
      uid: matchedUser.id,
      email: matchedUser.email,
      name: matchedUser.name,
      role: matchedUser.role
    };
    activeMockUser = payload;
    localStorage.setItem('qeist_auth_session', JSON.stringify(payload));
    notifyAuthListeners();
    return { user: payload };
  } else {
    // Auto-bootstrap demo accounts if they don't exist yet
    const demoDomain = normalizedEmail.includes('@gmail.com') || normalizedEmail.includes('@qeist.com');
    if (demoDomain) {
      const payload: MockUser = {
        uid: 'demo-user-' + Math.random().toString(36).substring(2, 10),
        email: trimmedEmail
      };
      activeMockUser = payload;
      localStorage.setItem('qeist_auth_session', JSON.stringify(payload));
      notifyAuthListeners();
      return { user: payload };
    }
    
    throw new Error('العينة غير مسجلة أو بيانات الاعتماد خاطئة (المحاكاة المحلية)');
  }
}

export async function createUserWithEmailAndPassword(authInstance: any, email: string, pass: string) {
  const trimmedEmail = email.trim();
  const lowerEmail = trimmedEmail.toLowerCase();

  if (supabase && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: pass
      });
      if (error) throw error;
      
      if (data?.user) {
        const payload: MockUser = {
          uid: data.user.id,
          email: data.user.email || trimmedEmail
        };
        (window as any).__sb_user_cache = payload;
        activeMockUser = payload;
        localStorage.setItem('qeist_auth_session', JSON.stringify(payload));
        notifyAuthListeners();
        return { user: payload };
      }
    } catch (err: any) {
      console.warn('[Supabase Auth] Live register failed. Creating local user:', err.message);
    }
  }

  // Local Offline register
  const localUsersList = getLocalTable('users');
  const matchedUser = localUsersList.find((u: any) => u.email?.toLowerCase() === lowerEmail);
  if (matchedUser) {
    throw { code: 'auth/email-already-in-use', message: 'Email already in use' };
  }

  const payload: MockUser = {
    uid: 'local-user-' + Date.now().toString(36),
    email: trimmedEmail
  };
  activeMockUser = payload;
  localStorage.setItem('qeist_auth_session', JSON.stringify(payload));
  notifyAuthListeners();
  return { user: payload };
}

export async function signOut(authInstance: any) {
  await auth.signOut();
}

// === Firestore Query Shims mapped to Supabase and Local Cache ===
export function doc(database: any, collectionName: string, id: string): DocRef {
  return { type: 'doc', collectionName, id };
}

export function collection(database: any, collectionName: string): CollectionRef {
  return { type: 'collection', collectionName };
}

export function query(baseRef: any, ...modifiers: any[]): QueryRef {
  const collectionName = baseRef.collectionName;
  const q: QueryRef = {
    type: 'query',
    collectionName,
    filters: [],
    limitVal: undefined
  };

  if (baseRef.type === 'query') {
    q.filters = [...baseRef.filters];
    q.limitVal = baseRef.limitVal;
  }

  modifiers.forEach((mod) => {
    if (mod.type === 'where') {
      q.filters.push(mod);
    } else if (mod.type === 'limit') {
      q.limitVal = mod.value;
    }
  });

  return q;
}

export function where(field: string, operator: string, value: any) {
  return { type: 'where', field, operator, value };
}

export function limit(value: number) {
  return { type: 'limit', value };
}

// === Execution Actions ===
export async function getDoc(docRef: DocRef) {
  const { collectionName, id } = docRef;

  if (supabase && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from(collectionName)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Cache locally for offline resiliency
        saveLocalDoc(collectionName, id, data);
        return {
          exists: () => true,
          data: () => data
        };
      }
    } catch (err) {
      console.warn(`[Supabase Database] Error getting doc ${collectionName}/${id}:`, err);
    }
  }

  // Local Offline retrieval
  const localDoc = getLocalDoc(collectionName, id);
  return {
    exists: () => localDoc !== null,
    data: () => localDoc
  };
}

export async function getDocFromServer(docRef: DocRef) {
  return getDoc(docRef);
}

export async function setDoc(docRef: DocRef, data: any, options?: { merge?: boolean }) {
  const { collectionName, id } = docRef;
  const payload = { ...data, id };

  // Write through to local database cache first (Always succeeds, offline first)
  saveLocalDoc(collectionName, id, payload);

  if (supabase && isSupabaseConfigured) {
    try {
      // Upsert using the Supabase client
      const { error } = await supabase
        .from(collectionName)
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;
      console.log(`[Supabase Service] Document ${collectionName}/${id} upserted successfully.`);
    } catch (err: any) {
      console.error(`[Supabase Service] Failed saving ${collectionName}/${id} to live database (retained locally):`, err.message);
    }
  }
}

export async function addDoc(collectionRef: CollectionRef, data: any) {
  const { collectionName } = collectionRef;
  const id = collectionName + '_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  const payload = { ...data, id };

  saveLocalDoc(collectionName, id, payload);

  if (supabase && isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from(collectionName)
        .insert(payload);

      if (error) throw error;
      console.log(`[Supabase Service] Document ${collectionName}/${id} inserted successfully.`);
    } catch (err: any) {
      console.error(`[Supabase Service] Failed inserting into ${collectionName} in live database:`, err.message);
    }
  }

  return { id };
}

export async function updateDoc(docRef: DocRef, updates: any) {
  const { collectionName, id } = docRef;

  // Update offline state first
  const currentLocal = getLocalDoc(collectionName, id) || {};
  const updatedDoc = { ...currentLocal, ...updates, id };
  saveLocalDoc(collectionName, id, updatedDoc);

  if (supabase && isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from(collectionName)
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      console.log(`[Supabase Service] Document ${collectionName}/${id} updated successfully.`);
    } catch (err: any) {
      console.error(`[Supabase Service] Failed updating doc ${collectionName}/${id} in live database:`, err.message);
    }
  }
}

export async function getDocs(queryRef: CollectionRef | QueryRef) {
  const collectionName = queryRef.collectionName;
  const filters = 'filters' in queryRef ? queryRef.filters : [];
  const limitVal = 'limitVal' in queryRef ? queryRef.limitVal : undefined;

  if (supabase && isSupabaseConfigured) {
    try {
      let q: any = supabase.from(collectionName).select('*');

      // Apply query constraints to postgres builder
      filters.forEach((filter) => {
        const { field, operator, value } = filter;
        if (operator === '==' || operator === '===') {
          q = q.eq(field, value);
        } else if (operator === 'in') {
          q = q.in(field, Array.isArray(value) ? value : [value]);
        } else if (operator === 'array-contains-any') {
          // PostgreSQL array contains
          q = q.filter(field, 'cs', Array.isArray(value) ? value : [value]);
        }
      });

      if (limitVal) {
        q = q.limit(limitVal);
      }

      const { data, error } = await q;
      if (error) throw error;

      if (data && Array.isArray(data)) {
        // Sync retrieved documents into local store cache for subsequent runs
        data.forEach((item: any) => {
          if (item?.id) {
            saveLocalDoc(collectionName, item.id, item);
          }
        });

        return {
          empty: data.length === 0,
          docs: data.map((item) => ({
            id: item.id,
            data: () => item
          }))
        };
      }
    } catch (err: any) {
      console.warn(`[Supabase Service] Failed getting ${collectionName} live query. Loading local cached fallback:`, err.message);
    }
  }

  // Local Offline retrieval filtering shims
  let localList = getLocalTable(collectionName);

  filters.forEach((filter) => {
    const { field, operator, value } = filter;
    if (operator === '==' || operator === '===') {
      localList = localList.filter((item: any) => item[field] === value);
    } else if (operator === 'in') {
      const allowed = Array.isArray(value) ? value : [value];
      localList = localList.filter((item: any) => allowed.includes(item[field]));
    } else if (operator === 'array-contains-any') {
      const allowedArray = Array.isArray(value) ? value : [value];
      localList = localList.filter((item: any) => {
        const itemArray = Array.isArray(item[field]) ? item[field] : [];
        return itemArray.some((val: any) => allowedArray.includes(val));
      });
    }
  });

  if (limitVal !== undefined) {
    localList = localList.slice(0, limitVal);
  }

  return {
    empty: localList.length === 0,
    docs: localList.map((item: any) => ({
      id: item.id,
      data: () => item
    }))
  };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export function increment(value: number) {
  return { __type: 'increment', value };
}

export function resolveIncrements(obj: any, currentData: any = {}) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = { ...obj };
  for (const key in clone) {
    if (clone[key] && typeof clone[key] === 'object' && clone[key].__type === 'increment') {
      const incVal = clone[key].value;
      const currentVal = typeof currentData[key] === 'number' ? currentData[key] : 0;
      clone[key] = currentVal + incVal;
    }
  }
  return clone;
}

export async function deleteDoc(docRef: DocRef) {
  const { collectionName, id } = docRef;
  const table = getLocalTable(collectionName);
  const updated = table.filter((item: any) => item.id !== id);
  saveLocalTable(collectionName, updated);

  if (supabase && isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from(collectionName)
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error(`[Supabase Service] Failed deleting doc ${collectionName}/${id}:`, err.message);
    }
  }
}

export function writeBatch(database: any) {
  const operations: Array<{type: 'set' | 'update' | 'delete', docRef: DocRef, data?: any}> = [];
  return {
    set: (docRef: DocRef, data: any) => {
      operations.push({ type: 'set', docRef, data });
    },
    update: (docRef: DocRef, updates: any) => {
      operations.push({ type: 'update', docRef, data: updates });
    },
    delete: (docRef: DocRef) => {
      operations.push({ type: 'delete', docRef });
    },
    commit: async () => {
      for (const op of operations) {
        if (op.type === 'set') {
          await setDoc(op.docRef, op.data);
        } else if (op.type === 'update') {
          await updateDoc(op.docRef, op.data);
        } else if (op.type === 'delete') {
          await deleteDoc(op.docRef);
        }
      }
    }
  };
}

export async function runTransaction(database: any, callback: (transaction: any) => Promise<any>) {
  const transaction = {
    get: async (docRef: DocRef) => {
      return getDoc(docRef);
    },
    set: (docRef: DocRef, data: any) => {
      const current = getLocalDoc(docRef.collectionName, docRef.id) || {};
      const resolved = resolveIncrements(data, current);
      saveLocalDoc(docRef.collectionName, docRef.id, resolved);
      
      if (supabase && isSupabaseConfigured) {
        supabase
          .from(docRef.collectionName)
          .upsert({ ...resolved, id: docRef.id })
          .then(({ error }) => {
            if (error) console.error('[Supabase Transaction] set error:', error);
          });
      }
    },
    update: (docRef: DocRef, updates: any) => {
      const current = getLocalDoc(docRef.collectionName, docRef.id) || {};
      const resolved = resolveIncrements(updates, current);
      saveLocalDoc(docRef.collectionName, docRef.id, { ...current, ...resolved });

      if (supabase && isSupabaseConfigured) {
        supabase
          .from(docRef.collectionName)
          .update(resolved)
          .eq('id', docRef.id)
          .then(({ error }) => {
            if (error) console.error('[Supabase Transaction] update error:', error);
          });
      }
    },
    delete: (docRef: DocRef) => {
      const table = getLocalTable(docRef.collectionName);
      saveLocalTable(docRef.collectionName, table.filter((item: any) => item.id !== docRef.id));

      if (supabase && isSupabaseConfigured) {
        supabase
          .from(docRef.collectionName)
          .delete()
          .eq('id', docRef.id)
          .then(({ error }) => {
            if (error) console.error('[Supabase Transaction] delete error:', error);
          });
      }
    }
  };

  return callback(transaction);
}
