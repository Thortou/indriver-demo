/**
 * LaoGo — passengers name their own fare, drivers accept or counter.
 * Mock data and mock timers only; no backend.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

import {
  NotoSansLao_400Regular,
  NotoSansLao_500Medium,
  NotoSansLao_600SemiBold,
  NotoSansLao_700Bold,
  NotoSansLao_800ExtraBold,
} from '@expo-google-fonts/noto-sans-lao';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

import { colors } from './src/theme';
import RootNavigator from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { killTimers } from './src/store/useStore';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [loaded, error] = useFonts({
    NotoSansLao_400Regular,
    NotoSansLao_500Medium,
    NotoSansLao_600SemiBold,
    NotoSansLao_700Bold,
    NotoSansLao_800ExtraBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  // every simulated driver/passenger reply is a setTimeout — drop them all on teardown
  useEffect(() => killTimers, []);

  // a stalled font download must never strand the app on a blank screen
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(id);
  }, []);

  const ready = loaded || !!error || timedOut;

  const onReady = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={onReady}>
            <StatusBar style="dark" />
            {ready ? <RootNavigator /> : <Booting />}
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

/** Visible placeholder while fonts load — system font, so it always renders. */
function Booting() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>LaoGo</Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginTop: 6 }}>Loading fonts…</Text>
    </View>
  );
}
