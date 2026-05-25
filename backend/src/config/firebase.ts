import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

let db: FirebaseFirestore.Firestore;

export function initFirebase(): void {
  if (admin.apps.length > 0) return;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }

  db = getFirestore();
  console.log('[Firebase] Initialized successfully');
}

export function getDb(): FirebaseFirestore.Firestore {
  if (!db) {
    initFirebase();
    db = getFirestore();
  }
  return db;
}
