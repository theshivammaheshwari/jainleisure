// Clean up invalid ledger entries in Firestore
// Run with: bun run clean-invalid-ledgers.ts

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC3o7nraQCqlxA9d6Hv_pDPcdyx81ejYFk",
  authDomain: "jainleisure.firebaseapp.com",
  projectId: "jainleisure",
  storageBucket: "jainleisure.firebasestorage.app",
  messagingSenderId: "835894438001",
  appId: "1:835894438001:web:4a69a4a415fb8a0b0993d0",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const adminUser = { email: "abhi95.india@gmail.com", password: "302031" };
const VALID_TYPES = ["debit", "credit", "discount"];

async function cleanInvalidLedgerEntries() {
  console.log("\n🔑 Signing in as admin...");
  await signInWithEmailAndPassword(auth, adminUser.email, adminUser.password);

  console.log("\n🔍 Fetching all ledger entries...");
  const snap = await getDocs(collection(db, "ledgerEntries"));
  let invalidCount = 0;

  for (const d of snap.docs) {
    const data = d.data();
    if (!VALID_TYPES.includes(data.entryType)) {
      console.log(`❌ Deleting invalid entry: ${d.id} (entryType: ${data.entryType})`);
      await deleteDoc(d.ref);
      invalidCount++;
    }
  }

  if (invalidCount === 0) {
    console.log("\n✅ No invalid ledger entries found.");
  } else {
    console.log(`\n🧹 Deleted ${invalidCount} invalid ledger entries.`);
  }
  process.exit(0);
}

cleanInvalidLedgerEntries().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
