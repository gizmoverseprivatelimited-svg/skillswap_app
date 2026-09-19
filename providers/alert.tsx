import React, { createContext, useContext, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Platform, Alert } from 'react-native';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface AlertContextType {
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AlertConfig | null>(null);

  const showAlert = useCallback((title: string, message?: string, buttons?: AlertButton[]) => {
    if (Platform.OS === 'web') {
      setConfig({ title, message, buttons });
    } else {
      const wrappedButtons = buttons?.map(btn => ({
        ...btn,
        onPress: btn.onPress ? () => {
          if (Platform.OS === 'ios') {
            setTimeout(() => {
              btn.onPress!();
            }, 100);
          } else {
            btn.onPress!();
          }
        } : undefined
      }));
      Alert.alert(title, message, wrappedButtons as any);
    }
  }, []);

  const handleButtonPress = (onPress?: () => void) => {
    setConfig(null);
    if (onPress) {
      onPress();
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {Platform.OS === 'web' && config && (
        <Modal
          transparent
          visible={!!config}
          animationType="fade"
          onRequestClose={() => setConfig(null)}
        >
          <View style={styles.overlay}>
            <View style={styles.alertBox}>
              <Text style={styles.title}>{config.title}</Text>
              {config.message ? <Text style={styles.message}>{config.message}</Text> : null}
              
              <View style={[
                styles.buttonContainer,
                config.buttons && config.buttons.length > 2 ? styles.verticalButtons : styles.horizontalButtons
              ]}>
                {config.buttons && config.buttons.length > 0 ? (
                  config.buttons.map((btn, index) => {
                    const isCancel = btn.style === 'cancel';
                    const isDestructive = btn.style === 'destructive';
                    
                    let buttonStyle = styles.button;
                    let textStyle = styles.buttonText;
                    
                    if (isCancel) {
                      buttonStyle = styles.cancelButton;
                      textStyle = styles.cancelButtonText;
                    } else if (isDestructive) {
                      buttonStyle = styles.destructiveButton;
                      textStyle = styles.destructiveButtonText;
                    } else {
                      buttonStyle = styles.primaryButton;
                      textStyle = styles.primaryButtonText;
                    }

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[buttonStyle, config.buttons && config.buttons.length > 2 ? { width: '100%', marginBottom: 8 } : { flex: 1 }]}
                        onPress={() => handleButtonPress(btn.onPress)}
                      >
                        <Text style={textStyle}>{btn.text}</Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryButton, { flex: 1 }]}
                    onPress={() => handleButtonPress()}
                  >
                    <Text style={styles.primaryButtonText}>OK</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)', // Slate-900 background with opacity
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  alertBox: {
    width: 400,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    borderWidth: 1,
    borderColor: '#E2E8F0', // slate-200
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A', // slate-900
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569', // slate-600
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 8,
  },
  horizontalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  verticalButtons: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  button: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    height: 44,
    borderRadius: 8,
    backgroundColor: '#6366F1', // Indigo-500
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9', // slate-100
    borderWidth: 1,
    borderColor: '#E2E8F0', // slate-200
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569', // slate-600
  },
  destructiveButton: {
    height: 44,
    borderRadius: 8,
    backgroundColor: '#EF4444', // red-500
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  destructiveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
