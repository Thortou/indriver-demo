/* =============================================================================
   Rate the passenger (§7.1): 1–5 stars, up to 3 tags, a one-line comment.
   ========================================================================== */

import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { C, theme } from '../../theme';
import { ApiError, errorText } from '../api';
import { loadMe, ratePassenger } from '../engine';
import { t } from '../i18n';
import { toast } from '../store';
import { Avatar, Btn, Chip, Field, Page, Sub, Stars } from '../ui';

const TAGS = ['polite', 'on_time', 'respectful', 'rude', 'late', 'left_mess'];

export default function RateScreen({ navigation, route }) {
  const { rideId, name } = route.params;
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const toggleTag = (tag) =>
    setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : cur.length >= 3 ? cur : [...cur, tag]));

  const submit = async () => {
    setBusy(true);
    try {
      await ratePassenger(rideId, stars, tags, comment);
      toast(t('thanksRating'));
      loadMe().catch(() => {});
      navigation.goBack();
    } catch (e) {
      // window closed / not rateable: nothing more to do here
      if (e instanceof ApiError && (e.code === 'rating.not_rateable' || e.code === 'rating.window_closed')) {
        navigation.goBack();
      }
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={t('ratePassenger')}
      onBack={() => navigation.goBack()}
      footer={<Btn title={t('submit')} onPress={submit} busy={busy} />}>
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        <Avatar name={name} size={72} />
        <Text style={st.name}>{name}</Text>
        <Sub>{t('rateTitle')}</Sub>
      </View>
      <View style={{ marginVertical: 16 }}>
        <Stars value={stars} onChange={setStars} size={40} />
      </View>
      <Sub style={{ marginBottom: 8 }}>{t('tagsMax')}</Sub>
      <View style={st.tags}>
        {TAGS.map((tag) => (
          <Chip key={tag} label={t(`tag_${tag}`)} active={tags.includes(tag)} onPress={() => toggleTag(tag)} />
        ))}
      </View>
      <Field
        placeholder={t('commentPlaceholder')}
        value={comment}
        onChangeText={(v) => setComment(v.replace(/[\r\n]+/g, ' '))}
        maxLength={500}
      />
    </Page>
  );
}

const st = theme({
  name: { color: C.text, fontSize: 20, lineHeight: 30, fontWeight: '700', marginTop: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
});
