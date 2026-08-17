import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maobane.afrijob',
  appName: 'AfriJob',
  webDir: 'dist',
  backgroundColor: '#1A1A1A',
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#1A1A1A',
      showSpinner: false,
      androidSplashResourceName: 'splash',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1A1A1A',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
