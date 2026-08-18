import React from 'react';
import { View } from 'react-native';
import { colors } from '../theme';
import { T } from './Typography';
import type { RideStage } from '../types';
import { STAGES } from '../types';

const LABELS: Record<RideStage, { lo: string; en: string }> = {
  onway: { lo: 'ຄົນຂັບກຳລັງມາ', en: 'Driver on the way' },
  arrived: { lo: 'ຮອດຈຸດຮັບແລ້ວ', en: 'Arrived' },
  intrip: { lo: 'ກຳລັງເດີນທາງ', en: 'In trip' },
  completed: { lo: 'ຮອດຈຸດໝາຍ', en: 'Completed' },
};

export function Timeline({ stage }: { stage: RideStage }) {
  const current = STAGES.indexOf(stage);

  return (
    <View>
      {STAGES.map((s, i) => {
        const done = i <= current;
        const isLast = i === STAGES.length - 1;
        return (
          <View key={s} style={{ flexDirection: 'row' }}>
            <View style={{ alignItems: 'center', width: 22 }}>
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: done ? colors.green : colors.surface,
                  borderWidth: 2,
                  borderColor: done ? colors.green : colors.border,
                }}
              />
              {!isLast && (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 26,
                    backgroundColor: i < current ? colors.green : colors.border,
                  }}
                />
              )}
            </View>

            <View style={{ flex: 1, marginLeft: 12, paddingBottom: isLast ? 0 : 12 }}>
              <T size={14} w={done ? 700 : 400} color={done ? colors.text : colors.muted}>
                {LABELS[s].lo}
              </T>
              <T size={10} color={colors.muted}>
                {LABELS[s].en}
              </T>
            </View>
          </View>
        );
      })}
    </View>
  );
}
