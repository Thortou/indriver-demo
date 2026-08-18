import type { Person } from '../types';

export const DRIVERS: Person[] = [
  { id: 'd1', lo: 'ສົມສັກ ພົມມະຈັນ',  en: 'Somsak Phommachan',  rating: 4.9, car: 'Toyota Vios',     plate: '1234 ວຽງຈັນ', trips: 2140 },
  { id: 'd2', lo: 'ບຸນມີ ໄຊຍະສານ',    en: 'Bounmy Xaiyasan',    rating: 4.7, car: 'Honda City',      plate: '5521 ວຽງຈັນ', trips: 980  },
  { id: 'd3', lo: 'ຄຳຫຼ້າ ວົງໄຊ',     en: 'Khamla Vongsai',     rating: 4.8, car: 'Toyota Yaris',    plate: '8890 ວຽງຈັນ', trips: 1560 },
  { id: 'd4', lo: 'ວິໄລ ສຸລິຍະວົງ',    en: 'Vilay Souliyavong',  rating: 5.0, car: 'Honda Wave',      plate: '3312 ວຽງຈັນ', trips: 3220 },
  { id: 'd5', lo: 'ອຳພອນ ແກ້ວມະນີ',   en: 'Amphone Keomany',    rating: 4.6, car: 'Suzuki Ertiga',   plate: '7745 ວຽງຈັນ', trips: 640  },
  { id: 'd6', lo: 'ດາລາ ຈັນທະວົງ',    en: 'Dala Chanthavong',   rating: 4.9, car: 'Toyota Sienta',   plate: '2208 ວຽງຈັນ', trips: 1875 },
];

export const PASSENGERS: Person[] = [
  { id: 'p1', lo: 'ນາລີ ສີສຸວັນ',      en: 'Nali Sisouvan',      rating: 4.9 },
  { id: 'p2', lo: 'ພູວົງ ອິນທະວົງ',    en: 'Phouvong Inthavong', rating: 4.8 },
  { id: 'p3', lo: 'ມະລິວັນ ພັນທະວົງ',  en: 'Malivan Phanthavong',rating: 5.0 },
  { id: 'p4', lo: 'ເກີດສະໜາ ລາຊະບຸນ',  en: 'Kerdsana Latsaboun', rating: 4.7 },
  { id: 'p5', lo: 'ສຸກສະຫວັນ ໄຊຍະວົງ', en: 'Souksavanh Xayavong',rating: 4.9 },
  { id: 'p6', lo: 'ຄຳພອນ ດວງມະນີ',    en: 'Khamphone Douangmany',rating: 4.8 },
];

/** The signed-in driver, per the spec's header. */
export const ME_DRIVER: Person = DRIVERS[0];

export const ME_PASSENGER: Person = {
  id: 'me',
  lo: 'ນາງ ສຸກດາ',
  en: 'Soukda',
  rating: 4.9,
};

export const NOTES = [
  'ມີກະເປົ໋າ 2 ໜ່ວຍ',
  'ຟ້າວໜ້ອຍໜຶ່ງ',
  'ລໍຖ້າຢູ່ປະຕູໜ້າ',
  'ໄປກັບເດັກນ້ອຍ 1 ຄົນ',
  undefined,
];
