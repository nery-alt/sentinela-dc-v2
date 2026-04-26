import { Tabs } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: Colors.navBackground, borderTopColor: Colors.border, borderTopWidth: 0.5 },
      tabBarActiveTintColor: Colors.primary,
      tabBarInactiveTintColor: Colors.textSecondary,
    }}>
      <Tabs.Screen name="cadastro" options={{ title: 'Cadastro', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text> }} />
      <Tabs.Screen name="vistoria" options={{ title: 'Vistoria', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🔍</Text> }} />
      <Tabs.Screen name="vistoria-tecnica" options={{ title: 'Vistoria Técnica', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📋</Text> }} />
    </Tabs>
  );
}
