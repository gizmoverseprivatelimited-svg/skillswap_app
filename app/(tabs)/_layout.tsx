import { Tabs } from "expo-router";
import { Home, Compass, User, BookOpen, Bell } from "lucide-react-native";
import React, { useMemo } from "react";

import Colors from "../../constants/colors";
import { useNotifications } from "../../providers/notifications";

export default function TabLayout() {
  const { unreadCount } = useNotifications();

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
    <Tabs
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
          elevation: 8,
          shadowColor: Colors.light.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600' as const,
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
          title: "Alerts",
          headerShown: false,
          tabBarBadge: notificationsBadge,
          tabBarBadgeStyle: notificationsBadge
            ? {
                backgroundColor: Colors.light.accent,
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: '700',
              }
            : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Bell
              size={24}
              color={color}
              fill={focused ? color : 'none'}
              strokeWidth={focused ? 2 : 2}
            />
          ),
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
  );
}
