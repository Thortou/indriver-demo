import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, HIT } from '../theme';
import { T } from './Typography';
import { PLACES } from '../data/places';
import type { Place } from '../types';

/** Mock place search over the Vientiane dataset. */
export function PlaceSearch({
  visible,
  titleLo,
  titleEn,
  excludeId,
  onPick,
  onClose,
}: {
  visible: boolean;
  titleLo: string;
  titleEn: string;
  excludeId?: string;
  onPick: (p: Place) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    return PLACES.filter((p) => {
      if (p.id === excludeId) return false;
      if (!n) return true;
      return p.lo.toLowerCase().includes(n) || p.en.toLowerCase().includes(n);
    });
  }, [q, excludeId]);

  const close = () => {
    setQ('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <View style={{ padding: 20, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <T size={20} w={700}>
                {titleLo}
              </T>
              <T size={12} color={colors.muted}>
                {titleEn}
              </T>
            </View>
            <Pressable
              onPress={close}
              hitSlop={12}
              style={{ minWidth: HIT, minHeight: HIT, alignItems: 'flex-end' }}>
              <T size={18} color={colors.muted}>
                ✕
              </T>
            </Pressable>
          </View>

          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="ຄົ້ນຫາ · Search places"
            placeholderTextColor={colors.muted}
            style={{
              marginTop: 14,
              backgroundColor: colors.input,
              borderRadius: radius.input,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 15,
              color: colors.text,
            }}
          />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingTop: 4 }}>
          {results.length === 0 && (
            <T size={13} color={colors.muted} center style={{ marginTop: 30 }}>
              ບໍ່ພົບສະຖານທີ່ · No matches
            </T>
          )}

          {results.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => {
                onPick(p);
                setQ('');
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: pressed ? colors.input : colors.surface,
                borderRadius: radius.card,
                padding: 16,
                marginBottom: 8,
                minHeight: HIT,
              })}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.input,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                <T size={14}>📍</T>
              </View>
              <View style={{ flex: 1 }}>
                <T size={15} w={600}>
                  {p.lo}
                </T>
                <T size={11} color={colors.muted}>
                  {p.en}
                </T>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
