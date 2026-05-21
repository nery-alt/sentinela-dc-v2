import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useSync } from '../hooks/useSync';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

export default function RootLayout() {
  const { session, loading, offlineNoSession } = useAuth();
  useSync();

  useEffect(() => {
    if (!loading && !offlineNoSession) {
      if (session) {
        router.replace('/(tabs)/cadastro');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [session, loading, offlineNoSession]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (offlineNoSession) {
    return (
      <View style={styles.center}>
        <Text style={styles.offlineText}>
          Sem conexão. Faça login quando tiver internet.
        </Text>
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  offlineText: {
    color: Colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
