// Fix: Migrate user docs to use auth UID as document ID
// Run with: bun run fix-users.ts

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, query, where } from "firebase/firestore";

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

const users = [
  { email: "abhi95.india@gmail.com", password: "302031", fullName: "Shivam (Admin)", role: "admin" },
  { email: "shivamtensor@gmail.com", password: "302019", fullName: "Shivam (Employee)", role: "employee" },
];

async function fix() {
  // Sign in first (need auth for Firestore access)
  console.log("🔐 Signing in as admin first...");
  await signInWithEmailAndPassword(auth, users[0].email, users[0].password);

  // Step 1: Delete all old user docs
  console.log("🗑️  Deleting old user documents...");
  const allDocs = await getDocs(collection(db, "users"));
  for (const d of allDocs.docs) {
    await deleteDoc(d.ref);
    console.log(`   Deleted: ${d.id}`);
  }

  // Step 2: Recreate with UID as document ID
  for (const u of users) {
    console.log(`\n🔐 Signing in as ${u.email}...`);
    const cred = await signInWithEmailAndPassword(auth, u.email, u.password);
    const uid = cred.user.uid;

    const now = new Date().toISOString();
    // Use setDoc with UID as doc ID (not addDoc with random ID)
    await setDoc(doc(db, "users", uid), {
      userId: uid,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`   ✅ Created doc users/${uid} → ${u.role}`);
  }

  console.log("\n🎉 Done! Security rules will now work correctly.");
  process.exit(0);
}

fix();
