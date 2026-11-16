/// <reference types="@capacitor-firebase/authentication" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.calisalworks.sahaball',
  appName: 'SahaBall',
  webDir: 'dist',
  backgroundColor: '#114224',
  android: {
    backgroundColor: '#114224',
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
