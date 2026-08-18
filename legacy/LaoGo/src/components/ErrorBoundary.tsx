import React from 'react';
import { ScrollView, Text, View } from 'react-native';

/**
 * Renders whatever blew up instead of a blank screen. Uses system fonts and no
 * third-party components on purpose — it must survive the failure it reports.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; info: string }
> {
  state = { error: null as Error | null, info: '' };

  static getDerivedStateFromError(error: Error) {
    return { error, info: '' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info: info.componentStack ?? '' });
    console.error('[LaoGo] render failure:', error, info.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={{ flex: 1, backgroundColor: '#1b0f0f', paddingTop: 70 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={{ color: '#ff8a7a', fontSize: 20, fontWeight: '700' }}>
            App crashed while rendering
          </Text>
          <Text style={{ color: '#ffd7d0', fontSize: 15, marginTop: 12, lineHeight: 22 }}>
            {error.message}
          </Text>
          {!!error.stack && (
            <Text style={{ color: '#c9a9a4', fontSize: 11, marginTop: 16, lineHeight: 16 }}>
              {error.stack.split('\n').slice(0, 12).join('\n')}
            </Text>
          )}
          {!!info && (
            <Text style={{ color: '#9a8480', fontSize: 11, marginTop: 16, lineHeight: 16 }}>
              {info.split('\n').slice(0, 12).join('\n')}
            </Text>
          )}
        </ScrollView>
      </View>
    );
  }
}
