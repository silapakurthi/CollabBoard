/**
 * One-off script to delete all boards and their subcollections from Firestore.
 * Usage: node --env-file=.env scripts/delete-all-boards.mjs
 */
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  writeBatch,
  doc,
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Sign in anonymously (Firestore rules may require auth)
await signInAnonymously(auth);
console.log("Signed in anonymously");

// Get all boards
const boardsSnap = await getDocs(collection(db, "boards"));
const total = boardsSnap.size;
console.log(`Found ${total} boards to delete`);

let deleted = 0;

// Process in batches of 20 boards at a time
const boardDocs = boardsSnap.docs;
const BATCH_SIZE = 20;

for (let i = 0; i < boardDocs.length; i += BATCH_SIZE) {
  const chunk = boardDocs.slice(i, i + BATCH_SIZE);

  await Promise.all(
    chunk.map(async (boardDoc) => {
      const boardId = boardDoc.id;

      // Delete subcollections (objects, presence)
      for (const sub of ["objects", "presence"]) {
        const subSnap = await getDocs(
          collection(db, `boards/${boardId}/${sub}`)
        );
        // Firestore batches max at 500 writes
        const subDocs = subSnap.docs;
        for (let j = 0; j < subDocs.length; j += 450) {
          const batch = writeBatch(db);
          subDocs.slice(j, j + 450).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }

      // Delete the board document itself
      await deleteDoc(doc(db, "boards", boardId));
      deleted++;
      process.stdout.write(`\rDeleted ${deleted}/${total} boards`);
    })
  );
}

console.log(`\nDone! Deleted ${deleted} boards.`);
process.exit(0);
