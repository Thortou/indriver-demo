import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors } from '../theme';
import { T } from '../components/Typography';
import { useStore } from '../store/useStore';

import RolePicker from '../screens/RolePicker';
import WhereToScreen from '../screens/passenger/WhereToScreen';
import RequestScreen from '../screens/passenger/RequestScreen';
import FindingScreen from '../screens/passenger/FindingScreen';
import RideScreen from '../screens/passenger/RideScreen';
import CompleteScreen from '../screens/passenger/CompleteScreen';
import HistoryScreen from '../screens/passenger/HistoryScreen';
import JobsScreen from '../screens/driver/JobsScreen';
import ActiveRideScreen from '../screens/driver/ActiveRideScreen';
import EarningsScreen from '../screens/driver/EarningsScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type PassengerStackParams = {
  /** step 1 — start + end location */
  WhereTo: undefined;
  /** step 2 — vehicle + fare */
  Request: undefined;
  Finding: undefined;
  Ride: undefined;
  Complete: undefined;
};

export type DriverStackParams = {
  Jobs: undefined;
  ActiveRide: undefined;
};

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.surface, border: colors.border },
};

/* ------------------------------------------------------------- tab chrome */

function tabLabel(lo: string, en: string) {
  return ({ focused }: { focused: boolean }) => (
    <View style={{ alignItems: 'center' }}>
      <T size={11} w={focused ? 700 : 500} color={focused ? colors.text : colors.muted}>
        {lo}
      </T>
      <T size={8} color={colors.muted}>
        {en}
      </T>
    </View>
  );
}

function tabIcon(glyph: string) {
  return ({ focused }: { focused: boolean }) => (
    <View
      style={{
        width: 40,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.lime : 'transparent',
      }}>
      <T size={13}>{glyph}</T>
    </View>
  );
}

const tabScreenOptions = {
  headerShown: false,
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: 72,
    paddingTop: 6,
    paddingBottom: 10,
  },
} as const;

/* --------------------------------------------------------------- stacks */

const PStack = createNativeStackNavigator<PassengerStackParams>();

function PassengerHomeStack() {
  return (
    <PStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <PStack.Screen name="WhereTo" component={WhereToScreen} />
      <PStack.Screen name="Request" component={RequestScreen} />
      <PStack.Screen name="Finding" component={FindingScreen} />
      <PStack.Screen name="Ride" component={RideScreen} />
      <PStack.Screen name="Complete" component={CompleteScreen} options={{ animation: 'fade' }} />
    </PStack.Navigator>
  );
}

const DStack = createNativeStackNavigator<DriverStackParams>();

function DriverJobsStack() {
  return (
    <DStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <DStack.Screen name="Jobs" component={JobsScreen} />
      <DStack.Screen name="ActiveRide" component={ActiveRideScreen} />
    </DStack.Navigator>
  );
}

/* ----------------------------------------------------------------- tabs */

const Tabs = createBottomTabNavigator();

function PassengerTabs() {
  return (
    <Tabs.Navigator screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="HomeTab"
        component={PassengerHomeStack}
        options={{ tabBarLabel: tabLabel('ໜ້າຫຼັກ', 'Home'), tabBarIcon: tabIcon('🏠') }}
      />
      <Tabs.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{ tabBarLabel: tabLabel('ປະຫວັດ', 'History'), tabBarIcon: tabIcon('🧾') }}
      />
      <Tabs.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: tabLabel('ໂປຣໄຟລ໌', 'Profile'), tabBarIcon: tabIcon('👤') }}
      />
    </Tabs.Navigator>
  );
}

function DriverTabs() {
  return (
    <Tabs.Navigator screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="JobsTab"
        component={DriverJobsStack}
        options={{ tabBarLabel: tabLabel('ວຽກ', 'Jobs'), tabBarIcon: tabIcon('📋') }}
      />
      <Tabs.Screen
        name="EarningsTab"
        component={EarningsScreen}
        options={{ tabBarLabel: tabLabel('ລາຍຮັບ', 'Earnings'), tabBarIcon: tabIcon('📈') }}
      />
      <Tabs.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: tabLabel('ໂປຣໄຟລ໌', 'Profile'), tabBarIcon: tabIcon('👤') }}
      />
    </Tabs.Navigator>
  );
}

/* ----------------------------------------------------------------- root */

const Root = createNativeStackNavigator();

export default function RootNavigator() {
  const role = useStore((s) => s.role);

  // NavigationContainer needs a navigator as its child — rendering RolePicker
  // bare here works by accident and breaks as soon as it touches navigation.
  return (
    <NavigationContainer theme={navTheme}>
      <Root.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {role === null ? (
          <Root.Screen name="RolePicker" component={RolePicker} />
        ) : role === 'passenger' ? (
          <Root.Screen name="Passenger" component={PassengerTabs} />
        ) : (
          <Root.Screen name="Driver" component={DriverTabs} />
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}
