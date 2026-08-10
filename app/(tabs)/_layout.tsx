import { Tabs } from "expo-router";
import { Home, Compass, User, BookOpen, Bell, Users } from "lucide-react-native";
import React, { useMemo } from "react";
import { Platform, useWindowDimensions } from "react-native";

import Colors from "../../constants/colors";
import { useNotifications } from "../../providers/notifications";

export default function TabLayout() {
  const { unreadCount } = useNotifications();
  const { width } = useWindowDimensions();

  const isSmallScreen = width < 770;

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
      {Platform.OS === 'web' && isSmallScreen && (
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
          `
        }} />
      )}
      <Tabs
        safeAreaInsets={isSmallScreen ? { top: 0, bottom: 0, left: 0, right: 0 } : undefined}
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
            paddingTop: isSmallScreen ? 4 : 0,
            paddingBottom: 4,
            paddingVertical: 4,
            height: isSmallScreen ? 60 : 60,
            elevation: 8,
            shadowColor: Colors.light.shadow,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
          },
          tabBarItemStyle: {
            paddingVertical: isSmallScreen ? 0 : 4,
            paddingTop: isSmallScreen ? 0 : 4,
            paddingBottom: isSmallScreen ? 0 : 4,
            paddingHorizontal: 0,
            marginVertical: 0,
            marginTop: 0,
            marginBottom: 0,
            height: isSmallScreen ? 68 : 60,
            justifyContent: 'center',
            alignItems: 'center',
          },
          tabBarLabelStyle: {
            fontSize: isSmallScreen ? 11 : 12,
            fontWeight: '600' as const,
            marginTop: isSmallScreen ? 0 : 2,
            marginBottom: isSmallScreen ? 0 : 2,
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
