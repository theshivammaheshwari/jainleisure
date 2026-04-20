// One-time setup script: Creates user profile documents in Firestore
// Run with: bun run setup-users.ts

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc, query, where, getDocs } from "firebase/firestore";

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
  { email: "shivamtensor@gmail.com", password: "692127", fullName: "Shivam (Admin)", role: "admin" },
  { email: "247shivam@gmail.com", password: "692127", fullName: "Shivam (Employee)", role: "employee" },
];

async function setup() {
  for (const u of users) {
    console.log(`\n🔐 Signing in as ${u.email}...`);
    try {
      const cred = await signInWithEmailAndPassword(auth, u.email, u.password);
      const uid = cred.user.uid;
      console.log(`   UID: ${uid}`);

      // Check if profile already exists
      const q = query(collection(db, "users"), where("userId", "==", uid));
      const existing = await getDocs(q);

      if (!existing.empty) {
        console.log(`   ⚠️  Profile already exists, skipping.`);
        continue;
      }

      // Create profile document
      const now = new Date().toISOString();
      await addDoc(collection(db, "users"), {
        userId: uid,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        createdAt: now,
        updatedAt: now,
      });

      console.log(`   ✅ Created ${u.role} profile for ${u.email}`);
    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  console.log("\n🎉 Setup complete! You can now login to the app.");
  process.exit(0);
}

setup();
