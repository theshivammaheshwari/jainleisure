import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  DocumentData,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

// ==================== TYPES ====================

export interface Firm {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  firmId: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  firmId: string;
  clientId: string;
  date: string;
  billNo: string | null;
  description: string | null;
  amount: number;
  entryType: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EditHistoryItem {
  id: string;
  entryId: string;
  firmId: string | null;
  clientId: string | null;
  oldData: Record<string, unknown>;
  newData: Record<string, unknown>;
  modifiedBy: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string | null;
  role: "admin" | "employee";
  createdAt: string;
  updatedAt: string;
}

// ==================== HELPERS ====================

const toISOString = (ts: unknown): string => {
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof ts === "string") return ts;
  return new Date().toISOString();
};

const nowISO = () => new Date().toISOString();

// ==================== FIRMS ====================

export async function getFirms(): Promise<Firm[]> {
  const q = query(collection(db, "firms"), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    name: d.data().name,
    createdAt: toISOString(d.data().createdAt),
    updatedAt: toISOString(d.data().updatedAt),
  }));
}

export async function addFirm(name: string): Promise<void> {
  await addDoc(collection(db, "firms"), {
    name,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });
}

export async function updateFirm(id: string, name: string): Promise<void> {
  await updateDoc(doc(db, "firms", id), { name, updatedAt: nowISO() });
}

export async function deleteFirm(id: string): Promise<void> {
  await deleteDoc(doc(db, "firms", id));
}

// ==================== CLIENTS ====================

export async function getClients(): Promise<(Client & { firmName?: string })[]> {
  const q = query(collection(db, "clients"), orderBy("name"));
  const snap = await getDocs(q);
  const clients = snap.docs.map((d) => ({
    id: d.id,
    name: d.data().name,
    firmId: d.data().firmId,
    phone: d.data().phone ?? null,
    address: d.data().address ?? null,
    createdAt: toISOString(d.data().createdAt),
    updatedAt: toISOString(d.data().updatedAt),
  }));

  // Resolve firm names
  const firmIds = [...new Set(clients.map((c) => c.firmId))];
  const firmMap: Record<string, string> = {};
  for (const firmId of firmIds) {
    const firmDoc = await getDoc(doc(db, "firms", firmId));
    if (firmDoc.exists()) firmMap[firmId] = firmDoc.data().name;
  }

  return clients.map((c) => ({ ...c, firmName: firmMap[c.firmId] }));
}

export async function getClientsByFirm(firmId: string): Promise<Client[]> {
  try {
    const q = query(collection(db, "clients"), where("firmId", "==", firmId), orderBy("name"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      name: d.data().name,
      firmId: d.data().firmId,
      phone: d.data().phone ?? null,
      address: d.data().address ?? null,
      createdAt: toISOString(d.data().createdAt),
      updatedAt: toISOString(d.data().updatedAt),
    }));
  } catch {
    // Fallback: query without orderBy if composite index is missing
    const q = query(collection(db, "clients"), where("firmId", "==", firmId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({
        id: d.id,
        name: d.data().name,
        firmId: d.data().firmId,
        phone: d.data().phone ?? null,
        address: d.data().address ?? null,
        createdAt: toISOString(d.data().createdAt),
        updatedAt: toISOString(d.data().updatedAt),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

export async function addClient(data: { name: string; firmId: string; phone?: string; address?: string }): Promise<void> {
  await addDoc(collection(db, "clients"), {
    name: data.name,
    firmId: data.firmId,
    phone: data.phone || null,
    address: data.address || null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });
}

export async function updateClient(id: string, data: { name: string; firmId: string; phone?: string; address?: string }): Promise<void> {
  await updateDoc(doc(db, "clients", id), {
    name: data.name,
    firmId: data.firmId,
    phone: data.phone || null,
    address: data.address || null,
    updatedAt: nowISO(),
  });
}

export async function deleteClient(id: string): Promise<void> {
  await deleteDoc(doc(db, "clients", id));
}

// ==================== LEDGER ENTRIES ====================

export async function getLedgerEntries(firmId: string, clientId: string, fyStart: string, fyEnd: string): Promise<LedgerEntry[]> {
  try {
    // Primary query with composite index (firmId, clientId, date, createdAt)
    const q = query(
      collection(db, "ledgerEntries"),
      where("firmId", "==", firmId),
      where("clientId", "==", clientId),
      where("date", ">=", fyStart),
      where("date", "<=", fyEnd),
      orderBy("date"),
      orderBy("createdAt")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapLedgerEntry(d.id, d.data()));
  } catch (err: unknown) {
    // Fallback: simpler query if composite index not yet created
    console.warn("Composite index missing, using fallback query. Create index via Firebase Console.", err);
    const q = query(
      collection(db, "ledgerEntries"),
      where("firmId", "==", firmId),
      where("clientId", "==", clientId)
    );
    const snap = await getDocs(q);
    const entries = snap.docs.map((d) => mapLedgerEntry(d.id, d.data()));
    // Client-side filter + sort
    return entries
      .filter((e) => e.date >= fyStart && e.date <= fyEnd)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  }
}

export async function addLedgerEntry(data: {
  firmId: string;
  clientId: string;
  date: string;
  billNo?: string;
  description?: string;
  amount: number;
  entryType: string;
  createdBy: string;
}): Promise<void> {
  await addDoc(collection(db, "ledgerEntries"), {
    firmId: data.firmId,
    clientId: data.clientId,
    date: data.date,
    billNo: data.billNo || null,
    description: data.description || null,
    amount: data.amount,
    entryType: data.entryType,
    createdBy: data.createdBy,
    updatedBy: data.createdBy,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });
}

export async function updateLedgerEntry(
  id: string,
  data: {
    date: string;
    billNo?: string;
    description?: string;
    amount: number;
    entryType: string;
    updatedBy: string;
    firmId?: string;
    clientId?: string;
  },
  oldData: Record<string, unknown>
): Promise<void> {
  await updateDoc(doc(db, "ledgerEntries", id), {
    date: data.date,
    billNo: data.billNo || null,
    description: data.description || null,
    amount: data.amount,
    entryType: data.entryType,
    updatedBy: data.updatedBy,
    updatedAt: nowISO(),
  });

  // Log edit history
  await addDoc(collection(db, "editHistory"), {
    entryId: id,
    firmId: data.firmId || null,
    clientId: data.clientId || null,
    oldData,
    newData: {
      date: data.date,
      billNo: data.billNo || null,
      description: data.description || null,
      amount: data.amount,
      entryType: data.entryType,
    },
    modifiedBy: data.updatedBy,
    createdAt: nowISO(),
  });
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  await deleteDoc(doc(db, "ledgerEntries", id));
}

function mapLedgerEntry(id: string, d: DocumentData): LedgerEntry {
  return {
    id,
    firmId: d.firmId,
    clientId: d.clientId,
    date: d.date,
    billNo: d.billNo ?? null,
    description: d.description ?? null,
    amount: Number(d.amount),
    entryType: d.entryType,
    createdBy: d.createdBy ?? null,
    updatedBy: d.updatedBy ?? null,
    createdAt: toISOString(d.createdAt),
    updatedAt: toISOString(d.updatedAt),
  };
}

// ==================== ALL LEDGER ENTRIES (for dashboard) ====================

export async function getAllLedgerEntries(): Promise<LedgerEntry[]> {
  const snap = await getDocs(collection(db, "ledgerEntries"));
  return snap.docs.map((d) => mapLedgerEntry(d.id, d.data()));
}

export async function checkDuplicateBillNo(firmId: string, billNo: string, clientId: string): Promise<{ duplicate: boolean; clientName?: string }> {
  const q = query(collection(db, "ledgerEntries"), where("firmId", "==", firmId), where("billNo", "==", billNo));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    if (d.data().clientId !== clientId) {
      // Found a different client with same bill no in this firm — fetch client name
      const clientSnap = await getDoc(doc(db, "clients", d.data().clientId));
      return { duplicate: true, clientName: clientSnap.exists() ? clientSnap.data().name : "Unknown" };
    }
  }
  return { duplicate: false };
}

// ==================== EDIT HISTORY ====================

export async function getEditHistory(limitCount: number): Promise<EditHistoryItem[]> {
  const q = query(
    collection(db, "editHistory"),
    orderBy("createdAt", "desc"),
    firestoreLimit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    entryId: d.data().entryId,
    firmId: d.data().firmId ?? null,
    clientId: d.data().clientId ?? null,
    oldData: d.data().oldData,
    newData: d.data().newData,
    modifiedBy: d.data().modifiedBy,
    createdAt: toISOString(d.data().createdAt),
  }));
}

// ==================== USERS / PROFILES ====================

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    fullName: d.fullName,
    email: d.email ?? null,
    role: d.role ?? "employee",
    createdAt: toISOString(d.createdAt),
    updatedAt: toISOString(d.updatedAt),
  };
}

export async function getUserProfiles(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  // Firestore 'in' supports max 30 values
  const map: Record<string, string> = {};
  const chunks = [];
  for (let i = 0; i < userIds.length; i += 30) {
    chunks.push(userIds.slice(i, i + 30));
  }
  for (const chunk of chunks) {
    const q = query(collection(db, "users"), where("userId", "in", chunk));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      map[d.data().userId] = d.data().fullName;
    });
  }
  return map;
}

// ==================== BACKUP ====================

export async function getFullBackup() {
  const [firms, clients, entries, history] = await Promise.all([
    getDocs(collection(db, "firms")),
    getDocs(collection(db, "clients")),
    getDocs(collection(db, "ledgerEntries")),
    getDocs(collection(db, "editHistory")),
  ]);

  return {
    exported_at: new Date().toISOString(),
    firms: firms.docs.map((d) => ({ id: d.id, ...d.data() })),
    clients: clients.docs.map((d) => ({ id: d.id, ...d.data() })),
    ledgerEntries: entries.docs.map((d) => ({ id: d.id, ...d.data() })),
    editHistory: history.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

export async function restoreFullBackup(backup: {
  firms?: { id: string; [key: string]: unknown }[];
  clients?: { id: string; [key: string]: unknown }[];
  ledgerEntries?: { id: string; [key: string]: unknown }[];
  editHistory?: { id: string; [key: string]: unknown }[];
}) {
  const collections = ["firms", "clients", "ledgerEntries", "editHistory"] as const;

  // Step 1: Delete all existing data
  for (const col of collections) {
    const snap = await getDocs(collection(db, col));
    // Firestore batch limit = 500, so chunk deletes
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // Step 2: Restore from backup
  for (const col of collections) {
    const items = backup[col] ?? [];
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db);
      items.slice(i, i + 400).forEach((item) => {
        const { id, ...data } = item;
        batch.set(doc(db, col, id), data);
      });
      await batch.commit();
    }
  }

  return {
    firms: backup.firms?.length ?? 0,
    clients: backup.clients?.length ?? 0,
    ledgerEntries: backup.ledgerEntries?.length ?? 0,
    editHistory: backup.editHistory?.length ?? 0,
  };
}
