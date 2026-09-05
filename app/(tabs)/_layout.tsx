import { Tabs } from "expo-router";
import { Home, Compass, User, BookOpen, Bell, Users } from "lucide-react-native";
import React, { useMemo } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "../../constants/colors";
import { useNotifications } from "../../providers/notifications";

export default function TabLayout() {
  const { unreadCount } = useNotifications();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isSmallScreen = width < 770;
  const isWeb = Platform.OS === 'web';
  const bottomInset = isWeb ? 0 : Math.max(insets.bottom, 8);

  const notificationsBadge = useMemo(() => {
    if (unreadCount === 0) {
      return undefined;
    }
    if (unreadCount > 9) {
      return "9+";
    }
    return unreadCount;
  }, [unreadCount]);

  return (
    <>
      {isWeb && (
        // @ts-ignore
        <style dangerouslySetInnerHTML={{
          __html: `
            [role="tab"], [role="tab"] a, a[role="tab"], div[role="tab"] {
              padding-top: 0px !important;
              padding-bottom: 0px !important;
              margin-top: 0px !important;
              margin-bottom: 0px !important;
              padding-left: 0px !important;
              padding-right: 0px !important;
            }
            /* Support dynamic safe area bottom gap in mobile browsers (Safari / Chrome iOS & Android) */
            nav[role="tablist"], [role="tablist"], div[style*="flex-direction: row"][style*="bottom: 0"] {
              padding-bottom: max(env(safe-area-inset-bottom, 0px), 8px) !important;
              height: calc(60px + max(env(safe-area-inset-bottom, 0px), 8px)) !important;
              box-sizing: content-box !important;
            }
          `
        }} />
      )}
      <Tabs
        safeAreaInsets={isWeb ? { top: 0, bottom: 0, left: 0, right: 0 } : undefined}
        screenOptions={{
          tabBarActiveTintColor: Colors.light.primary,
          tabBarInactiveTintColor: Colors.light.tabIconDefault,
          headerShown: true,
          headerStyle: {
            backgroundColor: Colors.light.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: Colors.light.borderLight,
          },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '700' as const,
            color: Colors.light.text,
          },
          tabBarStyle: {
            backgroundColor: Colors.light.background,
            borderTopColor: Colors.light.borderLight,
            borderTopWidth: 1,
            paddingTop: 6,
            paddingBottom: isWeb ? 8 : bottomInset,
            height: isWeb ? 68 : 60 + bottomInset,
            elevation: 8,
            shadowColor: Colors.light.shadow,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
          },
          tabBarItemStyle: {
            paddingVertical: 2,
            paddingHorizontal: 0,
            justifyContent: 'center',
            alignItems: 'center',
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600' as const,
            marginTop: 2,
            marginBottom: 0,
            paddingTop: 0,
            paddingBottom: 0,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <Home
                size={24}
                color={color}
                fill={focused ? color : 'none'}
                strokeWidth={focused ? 2 : 2}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: "Explore",
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <Compass
                size={24}
                color={color}
                fill={focused ? color : 'none'}
                strokeWidth={focused ? 2 : 2}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="classes"
          options={{
            title: "Classes",
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <Users
                size={24}
                color={color}
                fill={focused ? color : 'none'}
                strokeWidth={focused ? 2 : 2}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="resources"
          options={{
            title: "Resources",
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <BookOpen
                size={24}
                color={color}
                fill={focused ? color : 'none'}
                strokeWidth={focused ? 2 : 2}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            href: null,
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <User
                size={24}
                color={color}
                fill={focused ? color : 'none'}
                strokeWidth={focused ? 2 : 2}
              />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
