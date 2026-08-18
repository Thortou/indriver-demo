import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, font, radius, HIT } from '../theme';
import { T, Num } from './Typography';
import { groupDigits } from '../utils/format';

/** Below this share of the suggested fare, warn that nobody may take the ride. */
export const LOW_FARE_RATIO = 0.75;

/**
 * "Your fare" — big price with − / + stepping ₭5,000, editable by tap.
 * Warns in red once the passenger goes far below the going rate.
 */
export function FareStepper({
  value,
  onChange,
  step = 5000,
  suggested,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  suggested?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const tooLow = suggested != null && suggested > 0 && value < suggested * LOW_FARE_RATIO;
  const percentBelow = suggested ? Math.round((1 - value / suggested) * 100) : 0;

  const bump = (dir: 1 | -1) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(Math.max(step, value + dir * step));
  };

  const commit = () => {
    const n = parseInt(draft.replace(/[^0-9]/g, ''), 10);
    onChange(Number.isFinite(n) && n >= 1000 ? n : value);
    setEditing(false);
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <StepBtn label="−" onPress={() => bump(-1)} />

        <Pressable
          onPress={() => {
            setDraft(String(value));
            setEditing(true);
          }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 64 }}>
          {editing ? (
            <TextInput
              autoFocus
              value={draft}
              onChangeText={(t) => setDraft(t.replace(/[^0-9]/g, ''))}
              onBlur={commit}
              onSubmitEditing={commit}
              keyboardType="number-pad"
              selectTextOnFocus
              style={{
                fontFamily: font.numBold,
                fontSize: 34,
                color: colors.text,
                textAlign: 'center',
                padding: 0,
                minWidth: 160,
              }}
            />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Num size={24} w={600} color={colors.muted} style={{ marginRight: 4 }}>
                ₭
              </Num>
              <Num size={38} w={700}>
                {groupDigits(value)}
              </Num>
            </View>
          )}
          {!editing && (
            <T size={10} color={colors.muted}>
              ແຕະເພື່ອແກ້ໄຂ · tap to edit
            </T>
          )}
        </Pressable>

        <StepBtn label="+" onPress={() => bump(1)} />
      </View>

      {tooLow ? (
        <View
          style={{
            marginTop: 8,
            backgroundColor: colors.dangerBg,
            borderRadius: radius.input,
            paddingVertical: 10,
            paddingHorizontal: 12,
          }}>
          <T size={12} w={700} color={colors.danger} center>
            ລາຄາຕ່ຳກວ່າປົກກະຕິ {percentBelow}% — ອາດບໍ່ມີຄົນຂັບຮັບ
          </T>
          <T size={10} color={colors.danger} center>
            Well below the usual fare · drivers may not accept
          </T>
          <T size={10} color={colors.muted} center style={{ marginTop: 2 }}>
            ລາຄາແນະນຳ ₭ {groupDigits(suggested!)}
          </T>
        </View>
      ) : (
        suggested != null &&
        suggested !== value && (
          <T size={11} color={colors.muted} center style={{ marginTop: 2 }}>
            ລາຄາແນະນຳ ₭ {groupDigits(suggested)} · suggested
          </T>
        )
      )}
    </View>
  );
}

function StepBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: HIT + 4,
        height: HIT + 4,
        borderRadius: radius.input,
        backgroundColor: pressed ? colors.lime : colors.input,
        alignItems: 'center',
        justifyContent: 'center',
      })}>
      <Num size={22} w={700}>
        {label}
      </Num>
    </Pressable>
  );
}
