import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAlRmIvDdoVXciw9vPPvEYVetV-T9cCUUI',
  authDomain: 'autoflow-781da.firebaseapp.com',
  projectId: 'autoflow-781da',
  storageBucket: 'autoflow-781da.firebasestorage.app',
  messagingSenderId: '704241322700',
  appId: '1:704241322700:web:a80bb14bb070bdedb2d069',
};

export const firebaseVapidKey =
  'BKTj6we0u919GlMloRi50hOBgMoz9DYk9xaXS86jnKq5BKNjKgvoT_Dn6-3ehhtqTnf80Wv9ru2xizmCvcWO3aY';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
