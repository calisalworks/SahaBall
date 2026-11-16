import { getApp, getApps, initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyBr3m2aUFX33EDJctGmqRiil8y9aC0GEPw',
  authDomain: 'sahaball-17d87.firebaseapp.com',
  projectId: 'sahaball-17d87',
  storageBucket: 'sahaball-17d87.firebasestorage.app',
  messagingSenderId: '280256783543',
  appId: '1:280256783543:web:2f262efedf3aa7d0379932',
};

// The Capacitor Firebase Authentication web implementation expects
// the default Firebase app to exist before its first auth call.
export const firebaseApp = getApps().length > 0
  ? getApp()
  : initializeApp(firebaseConfig);
