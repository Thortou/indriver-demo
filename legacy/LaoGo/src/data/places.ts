import type { Place } from '../types';

/** Real locations around Vientiane with accurate coordinates. */
export const PLACES: Place[] = [
  { id: 'morning-market', lo: 'ຕະຫຼາດເຊົ້າ',                 en: 'Morning Market',      lat: 17.9668, lng: 102.6135 },
  { id: 'wattay',         lo: 'ສະໜາມບິນວັດໄຕ',               en: 'Wattay Airport',      lat: 17.9884, lng: 102.5633 },
  { id: 'patuxay',        lo: 'ປະຕູໄຊ',                      en: 'Patuxay',             lat: 17.9757, lng: 102.6167 },
  { id: 'that-luang',     lo: 'ພະທາດຫຼວງ',                   en: 'That Luang',          lat: 17.9757, lng: 102.6335 },
  { id: 'khua-din',       lo: 'ຕະຫຼາດຂົວດິນ',                 en: 'Khua Din Market',     lat: 17.9679, lng: 102.6161 },
  { id: 'phonthong',      lo: 'ໂພນທອງ',                      en: 'Phonthong',           lat: 17.9720, lng: 102.5940 },
  { id: 'itecc',          lo: 'ໄອເຕັກ',                      en: 'ITECC Mall',          lat: 17.9853, lng: 102.6469 },
  { id: 'mahosot',        lo: 'ໂຮງໝໍມະໂຫສົດ',                en: 'Mahosot Hospital',    lat: 17.9583, lng: 102.6083 },
  { id: 'dongdok',        lo: 'ມະຫາວິທະຍາໄລ ດົງໂດກ',         en: 'NUOL Dongdok',        lat: 18.0575, lng: 102.5442 },
  { id: 'si-muang',       lo: 'ວັດສີເມືອງ',                   en: 'Wat Si Muang',        lat: 17.9600, lng: 102.6183 },
  { id: 'anouvong',       lo: 'ສວນເຈົ້າອະນຸວົງ',              en: 'Chao Anouvong Park',  lat: 17.9611, lng: 102.6053 },
  { id: 'thong-khan-kham',lo: 'ຕະຫຼາດທົ່ງຂັນຄຳ',              en: 'Thong Khan Kham',     lat: 17.9760, lng: 102.6060 },
];

export const placeById = (id: string) => PLACES.find((p) => p.id === id) ?? PLACES[0];
