/* =============================================================================
   inseeDrive Driver — the driver app for the inseeDrive ride-hailing backend.

   Built to DRIVER_APP_API.md: sign-up with documents, login, online/offline
   with GPS, live ride requests with accept / counter / skip, the trip, rating
   the passenger, earnings, wallet and history. Realtime over WebSocket with a
   5 s polling fallback; push over FCM in development builds.

   Layout
     src/api.js        HTTP client, errors, token refresh, uploads
     src/config.js     base URL, device id, language (SecureStore)
     src/engine.js     every API action + the hook that keeps state fresh
     src/location.js   GPS sender (foreground + background task)
     src/realtime.js   WebSocket client
     src/push.js       FCM registration and notification handling
     src/store.js      zustand state
     src/screens/*     screens; src/ui.js shared components
   ========================================================================== */

import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { C, FONTS, lao } from './theme';
import { boot, useDriverEngine } from './src/engine';
import { t } from './src/i18n';
import { useApp, visibleRide } from './src/store';
import { Toast } from './src/ui';
import { LoginScreen, SettingsScreen } from './src/screens/AuthScreens';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import EarningsScreen from './src/screens/EarningsScreen';
import { HistoryScreen, RideDetailScreen } from './src/screens/HistoryScreens';
import { AccountScreen, ReplaceDocsScreen } from './src/screens/AccountScreens';
import RateScreen from './src/screens/RateScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const navRef = createNavigationContainerRef();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: C.bg, primary: C.accentText, card: C.card, border: C.line },
};

const TAB_ICONS = { Home: '🚗', Earnings: '💰', History: '🕘', Account: '👤' };
const TAB_LABELS = { Home: 'tabHome', Earnings: 'tabEarnings', History: 'tabHistory', Account: 'tabAccount' };

function MainTabs() {
  useApp((s) => s.lang); // relabel tabs on language change
  const onTrip = useApp((s) => {
    const r = visibleRide(s);
    return !!(r && r.active);
  });
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.text,
        tabBarInactiveTintColor: C.faint,
        tabBarLabelStyle: { ...lao(600), fontSize: 11.5 },
        tabBarStyle: { borderTopColor: C.line, backgroundColor: C.card },
        tabBarLabel: t(TAB_LABELS[route.name]),
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{TAB_ICONS[route.name]}</Text>
        ),
        tabBarBadge: route.name === 'Home' && onTrip ? '•' : undefined,
      })}>
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Earnings" component={EarningsScreen} />
      <Tabs.Screen name="History" component={HistoryScreen} />
      <Tabs.Screen name="Account" component={AccountScreen} />
    </Tabs.Navigator>
  );
}

function Shell() {
  const booted = useApp((s) => s.booted);
  const session = useApp((s) => s.session);
  const toast = useApp((s) => s.toast);

  useDriverEngine({
    onOpenHome: () => {
      if (navRef.isReady()) navRef.navigate('Tabs', { screen: 'Home' });
    },
  });

  if (!booted) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.accentText} />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer ref={navRef} theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
          {session ? (
            <>
              <Stack.Screen name="Tabs" component={MainTabs} />
              <Stack.Screen name="Rate" component={RateScreen} />
              <Stack.Screen name="RideDetail" component={RideDetailScreen} />
              <Stack.Screen name="ReplaceDocs" component={ReplaceDocsScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Signup" component={SignupScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <Toast text={toast} />
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    boot().catch(() => useApp.setState({ booted: true }));
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Shell />
    </SafeAreaProvider>
  );
}
