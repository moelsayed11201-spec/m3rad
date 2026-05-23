import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, setLogLevel, enableIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Suppress benign warnings like "Disconnecting idle stream"
setLogLevel('error');

// Enable offline persistence to improve caching and handle quota exhaustion seamlessly
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore offline persistence failed-precondition: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore offline persistence unimplemented by current browser');
    } else {
      console.error('Firestore offline persistence error:', err);
    }
  });
}

