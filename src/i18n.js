/* =============================================================================
   i18n.js — Lao (default) and English strings, and date/money formatting.

   The server already translates `detail` and push titles (Lang header), so
   this file only covers the app's own labels.
   ========================================================================== */

import { fmtNum } from '../theme';

const STRINGS = {
  // common
  retry: { lo: 'ລອງໃໝ່', en: 'Try again' },
  cancel: { lo: 'ຍົກເລີກ', en: 'Cancel' },
  close: { lo: 'ປິດ', en: 'Close' },
  save: { lo: 'ບັນທຶກ', en: 'Save' },
  next: { lo: 'ຕໍ່ໄປ', en: 'Next' },
  back: { lo: 'ກັບຄືນ', en: 'Back' },
  done: { lo: 'ສຳເລັດ', en: 'Done' },
  submit: { lo: 'ສົ່ງ', en: 'Submit' },
  loading: { lo: 'ກຳລັງໂຫຼດ…', en: 'Loading…' },
  loadMore: { lo: 'ໂຫຼດເພີ່ມ', en: 'Load more' },
  empty: { lo: 'ບໍ່ມີຂໍ້ມູນ', en: 'Nothing here yet' },
  somethingWrong: { lo: 'ມີບາງຢ່າງຜິດພາດ, ກະລຸນາລອງໃໝ່', en: 'Something went wrong, try again' },
  network: { lo: 'ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້', en: 'Cannot reach the server' },
  unavailableFeature: { lo: 'ຄຸນສົມບັດນີ້ຍັງບໍ່ເປີດໃຊ້', en: 'This feature is not available right now' },
  signupUnavailable: { lo: 'ການສະໝັກຍັງບໍ່ເປີດໃຊ້ໃນຕອນນີ້', en: 'Sign-up is not available right now' },
  waitSeconds: { lo: 'ລໍຖ້າ {n} ວິນາທີ', en: 'Wait {n} s' },

  // auth
  appName: { lo: 'inseeDrive ຄົນຂັບ', en: 'inseeDrive Driver' },
  tagline: { lo: 'ຮັບວຽກ, ຕໍ່ລອງລາຄາ, ຂັບເອງ', en: 'Take rides. Name your price.' },
  phone: { lo: 'ເບີໂທລະສັບ', en: 'Phone number' },
  password: { lo: 'ລະຫັດຜ່ານ', en: 'Password' },
  login: { lo: 'ເຂົ້າສູ່ລະບົບ', en: 'Log in' },
  logout: { lo: 'ອອກຈາກລະບົບ', en: 'Log out' },
  badCredentials: { lo: 'ເບີໂທ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ', en: 'Phone number or password is incorrect' },
  noAccount: { lo: 'ຍັງບໍ່ມີບັນຊີຄົນຂັບ?', en: "Don't have a driver account?" },
  signup: { lo: 'ສະໝັກເປັນຄົນຂັບ', en: 'Sign up as a driver' },
  serverSettings: { lo: 'ຕັ້ງຄ່າເຊີບເວີ', en: 'Server settings' },

  // sign-up
  signupStep1: { lo: 'ເບີໂທຂອງທ່ານ', en: 'Your phone number' },
  signupStep2: { lo: 'ຮູບເອກະສານ', en: 'Document photos' },
  signupStep3: { lo: 'ຂໍ້ມູນ ແລະ ລົດ', en: 'Details and vehicle' },
  alreadyDrives: { lo: 'ເບີນີ້ມີບັນຊີຄົນຂັບແລ້ວ', en: 'This number already has a driver account' },
  goToLogin: { lo: 'ໄປໜ້າເຂົ້າສູ່ລະບົບ', en: 'Go to log in' },
  takePhoto: { lo: 'ຖ່າຍຮູບ', en: 'Take photo' },
  chooseFromLibrary: { lo: 'ເລືອກຈາກຄັງຮູບ', en: 'Choose from library' },
  uploading: { lo: 'ກຳລັງອັບໂຫຼດ…', en: 'Uploading…' },
  uploaded: { lo: 'ອັບໂຫຼດແລ້ວ', en: 'Uploaded' },
  allPhotosNeeded: { lo: 'ກະລຸນາອັບໂຫຼດຮູບໃຫ້ຄົບ 7 ຮູບ', en: 'Please upload all 7 photos' },
  ticketExpired: { lo: 'ໝົດເວລາສະໝັກ, ກະລຸນາເລີ່ມໃໝ່', en: 'Sign-up session expired, please start again' },
  fullName: { lo: 'ຊື່ ແລະ ນາມສະກຸນ', en: 'Full name' },
  email: { lo: 'ອີເມວ (ທາງເລືອກ)', en: 'Email (optional)' },
  passwordHint: { lo: 'ຢ່າງໜ້ອຍ 8 ຕົວອັກສອນ', en: 'At least 8 characters' },
  licenseNumber: { lo: 'ເລກໃບຂັບຂີ່', en: 'Licence number' },
  licenseExpiry: { lo: 'ໃບຂັບຂີ່ໝົດອາຍຸ', en: 'Licence expiry' },
  idCardNumber: { lo: 'ເລກບັດປະຈຳຕົວ', en: 'ID card number' },
  idCardExpiry: { lo: 'ບັດປະຈຳຕົວໝົດອາຍຸ', en: 'ID card expiry' },
  vehicle: { lo: 'ລົດ', en: 'Vehicle' },
  vehicleType: { lo: 'ປະເພດລົດ', en: 'Vehicle type' },
  plate: { lo: 'ປ້າຍທະບຽນ', en: 'Plate number' },
  make: { lo: 'ຍີ່ຫໍ້', en: 'Make' },
  model: { lo: 'ລຸ້ນ', en: 'Model' },
  color: { lo: 'ສີ', en: 'Colour' },
  year: { lo: 'ປີ', en: 'Year' },
  registrationExpiry: { lo: 'ໃບທະບຽນລົດໝົດອາຍຸ', en: 'Registration expiry' },
  insuranceExpiry: { lo: 'ປະກັນໄພໝົດອາຍຸ', en: 'Insurance expiry' },
  dateFormatIso: { lo: 'YYYY-MM-DD', en: 'YYYY-MM-DD' },
  dateFormatDmy: { lo: 'DD-MM-YYYY', en: 'DD-MM-YYYY' },
  required: { lo: 'ຈຳເປັນ', en: 'Required' },
  stepOf: { lo: 'ຂັ້ນຕອນ {n} / {total}', en: 'Step {n} of {total}' },
  sg_phone: { lo: 'ເບີໂທລະສັບ', en: 'Phone number' },
  sg_phone_sub: { lo: 'ພວກເຮົາຈະໃຊ້ເບີນີ້ເພື່ອເຂົ້າສູ່ລະບົບ', en: 'You will log in with this number' },
  sg_account: { lo: 'ຂໍ້ມູນສ່ວນຕົວ', en: 'About you' },
  sg_account_sub: { lo: 'ຊື່, ລະຫັດຜ່ານ ແລະ ຮູບໂປຣໄຟລ໌', en: 'Name, password and profile photo' },
  sg_license: { lo: 'ໃບຂັບຂີ່', en: 'Driving licence' },
  sg_license_sub: { lo: 'ຖ່າຍຮູບໃບຂັບຂີ່ ແລະ ເຊວຟີຖືໃບຂັບຂີ່', en: 'Photo of the licence, and a selfie holding it' },
  sg_id: { lo: 'ບັດປະຈຳຕົວ', en: 'ID card' },
  sg_id_sub: { lo: 'ເລກບັດ, ວັນໝົດອາຍຸ ແລະ ຮູບບັດ', en: 'Number, expiry and a photo of the card' },
  sg_vehicle: { lo: 'ລົດຂອງທ່ານ', en: 'Your vehicle' },
  sg_vehicle_sub: { lo: 'ຂໍ້ມູນລົດ ແລະ ຮູບລົດ', en: 'Vehicle details and a photo' },
  sg_registration: { lo: 'ໃບທະບຽນລົດ', en: 'Vehicle registration' },
  sg_registration_sub: { lo: 'ຮູບໃບທະບຽນ ແລະ ວັນໝົດອາຍຸ', en: 'Photo of the registration and its expiry' },
  sg_insurance: { lo: 'ປະກັນໄພ', en: 'Insurance' },
  sg_insurance_sub: { lo: 'ຮູບໃບປະກັນໄພ ແລະ ວັນໝົດອາຍຸ', en: 'Photo of the insurance and its expiry' },
  sg_review: { lo: 'ກວດຄືນ ແລະ ສົ່ງ', en: 'Review and submit' },
  sg_review_sub: { lo: 'ກວດຂໍ້ມູນກ່ອນສົ່ງ. ແຕະເພື່ອແກ້ໄຂ.', en: 'Check everything before sending. Tap a step to edit.' },
  photoNeeded: { lo: 'ກະລຸນາອັບໂຫຼດຮູບນີ້', en: 'Please upload this photo' },
  retake: { lo: 'ຖ່າຍໃໝ່', en: 'Retake' },
  edit: { lo: 'ແກ້ໄຂ', en: 'Edit' },
  dateInPast: { lo: 'ວັນທີນີ້ຜ່ານມາແລ້ວ', en: 'This date is in the past' },
  signupDone: { lo: 'ສົ່ງໃບສະໝັກແລ້ວ', en: 'Application sent' },
  signupDoneBody: {
    lo: 'ບັນຊີຂອງທ່ານກຳລັງຖືກກວດສອບ. ເຂົ້າສູ່ລະບົບເພື່ອເບິ່ງສະຖານະ.',
    en: 'Your account is under review. Log in to follow its status.',
  },

  // documents
  doc_profile_photo: { lo: 'ຮູບໂປຣໄຟລ໌', en: 'Profile photo' },
  doc_license_photo: { lo: 'ຮູບໃບຂັບຂີ່', en: 'Licence photo' },
  doc_license_selfie: { lo: 'ເຊວຟີກັບໃບຂັບຂີ່', en: 'Selfie with licence' },
  doc_id_card_photo: { lo: 'ຮູບບັດປະຈຳຕົວ', en: 'ID card photo' },
  doc_vehicle_photo: { lo: 'ຮູບລົດ', en: 'Vehicle photo' },
  doc_registration_doc: { lo: 'ໃບທະບຽນລົດ', en: 'Registration document' },
  doc_insurance_doc: { lo: 'ໃບປະກັນໄພ', en: 'Insurance document' },
  state_valid: { lo: 'ໃຊ້ໄດ້', en: 'Valid' },
  state_expiring_soon: { lo: 'ເຫຼືອ {n} ມື້', en: '{n} days left' },
  state_expired: { lo: 'ໝົດອາຍຸ', en: 'Expired' },
  state_missing: { lo: 'ຍັງບໍ່ມີ', en: 'Missing' },
  expiresOn: { lo: 'ໝົດອາຍຸ {d}', en: 'Expires {d}' },

  // verification
  vs_pending: { lo: 'ລໍຖ້າສົ່ງເອກະສານ', en: 'Pending' },
  vs_under_review: { lo: 'ກຳລັງກວດສອບ', en: 'Under review' },
  vs_approved: { lo: 'ອະນຸມັດແລ້ວ', en: 'Approved' },
  vs_rejected: { lo: 'ຖືກປະຕິເສດ', en: 'Rejected' },
  reviewBody: {
    lo: 'ທີມງານກຳລັງກວດສອບເອກະສານຂອງທ່ານ. ທ່ານຈະຮັບວຽກໄດ້ຫຼັງຈາກອະນຸມັດ.',
    en: 'We are checking your documents. You can take rides once approved.',
  },
  rejectionReason: { lo: 'ເຫດຜົນ', en: 'Reason' },
  replaceDocs: { lo: 'ປ່ຽນເອກະສານ', en: 'Replace documents' },
  replaceWarnApproved: {
    lo: 'ການປ່ຽນເອກະສານຈະສົ່ງບັນຊີຂອງທ່ານກັບໄປກວດສອບໃໝ່ ແລະ ທ່ານຈະຮັບວຽກບໍ່ໄດ້ຈົນກວ່າຈະອະນຸມັດ. ສືບຕໍ່ບໍ?',
    en: 'Replacing a document sends your account back to review, and you cannot take rides until it is approved again. Continue?',
  },
  replaceIntro: {
    lo: 'ເລືອກເອກະສານທີ່ຕ້ອງການປ່ຽນ. ສົ່ງສະເພາະສິ່ງທີ່ປ່ຽນ.',
    en: 'Pick the documents to replace. Only what changed is sent.',
  },
  nothingToSubmit: { lo: 'ຍັງບໍ່ໄດ້ປ່ຽນຫຍັງ', en: 'Nothing changed yet' },
  submitted: { lo: 'ສົ່ງແລ້ວ', en: 'Submitted' },
  newDriver: { lo: 'ຄົນຂັບໃໝ່', en: 'New driver' },
  totalRides: { lo: 'ຖ້ຽວທັງໝົດ', en: 'Total rides' },
  rating: { lo: 'ຄະແນນ', en: 'Rating' },
  documents: { lo: 'ເອກະສານ', en: 'Documents' },
  missingItems: { lo: 'ຍັງຂາດ', en: 'Still missing' },

  // availability (§4.3)
  av_AVAILABLE: { lo: 'ອອນລາຍ – ລໍຖ້າວຽກ', en: 'Online – waiting for requests' },
  av_NOT_ELIGIBLE: { lo: 'ບັນຊີຂອງທ່ານຍັງບໍ່ໄດ້ຮັບອະນຸມັດ', en: 'Your account is not approved yet' },
  av_DOCUMENT_EXPIRED: { lo: 'ມີເອກະສານໝົດອາຍຸ', en: 'A document has expired' },
  av_OFFLINE: { lo: 'ອອບລາຍ', en: 'Offline' },
  av_COMMISSION_OWED: {
    lo: 'ກະລຸນາຊຳລະຄ່ານາຍໜ້າທີ່ຄ້າງຢູ່ຫ້ອງການ',
    en: 'Please pay the commission you owe at the office',
  },
  av_STANDING_UNKNOWN: { lo: 'ບໍ່ພ້ອມຊົ່ວຄາວ, ກຳລັງລອງໃໝ່…', en: 'Temporarily unavailable, retrying…' },
  av_ON_RIDE: { lo: 'ກຳລັງມີຖ້ຽວ', en: 'You have an active trip' },
  av_NO_LOCATION: { lo: 'ລໍຖ້າ GPS…', en: 'Waiting for GPS…' },
  av_LOCATION_STALE: {
    lo: 'ຕຳແໜ່ງບໍ່ອັບເດດ: ກວດ GPS/ອິນເຕີເນັດ',
    en: 'Location not updating: check GPS/Internet',
  },
  av_LOCATION_UNKNOWN: { lo: 'ບໍ່ພ້ອມຊົ່ວຄາວ', en: 'Temporarily unavailable' },
  av_unknown: { lo: 'ບໍ່ພ້ອມຮັບວຽກ ({r})', en: 'Not available ({r})' },
  goOnline: { lo: 'ເປີດຮັບວຽກ', en: 'Go online' },
  goOffline: { lo: 'ປິດຮັບວຽກ', en: 'Go offline' },
  online: { lo: 'ອອນລາຍ', en: 'Online' },
  offline: { lo: 'ອອບລາຍ', en: 'Offline' },
  openProfile: { lo: 'ເບິ່ງໂປຣໄຟລ໌', en: 'Open profile' },
  openWallet: { lo: 'ເບິ່ງກະເປົາ', en: 'Open wallet' },
  locationDenied: {
    lo: 'ຕ້ອງອະນຸຍາດຕຳແໜ່ງເພື່ອອອນລາຍ',
    en: 'Location permission is needed to go online',
  },
  backgroundOff: {
    lo: 'ສົ່ງຕຳແໜ່ງສະເພາະຕອນເປີດແອັບ (Expo Go)',
    en: 'Location is sent only while the app is open (Expo Go)',
  },
  onlineNotifTitle: { lo: 'ທ່ານກຳລັງອອນລາຍ', en: 'You are online' },
  onlineNotifBody: { lo: 'ກຳລັງສົ່ງຕຳແໜ່ງເພື່ອຮັບວຽກ', en: 'Sharing your location to receive rides' },

  // requests & offers (§5)
  requests: { lo: 'ວຽກໃກ້ທ່ານ', en: 'Nearby requests' },
  noRequests: { lo: 'ຍັງບໍ່ມີວຽກໃກ້ທ່ານ', en: 'No requests nearby yet' },
  goOnlineToSee: { lo: 'ເປີດຮັບວຽກເພື່ອເບິ່ງຄຳຂໍ', en: 'Go online to see requests' },
  fromYou: { lo: 'ຫ່າງ {d}', en: '{d} away' },
  accept: { lo: 'ຮັບ', en: 'Accept' },
  counter: { lo: 'ຕໍ່ລອງ', en: 'Counter' },
  skip: { lo: 'ຂ້າມ', en: 'Skip' },
  expiresIn: { lo: 'ໝົດເວລາໃນ {t}', en: 'Expires in {t}' },
  expired: { lo: 'ໝົດເວລາ', en: 'Expired' },
  offeredPrice: { lo: 'ລາຄາທີ່ຜູ້ໂດຍສານສະເໜີ', en: "Rider's price" },
  counterTitle: { lo: 'ສະເໜີລາຄາໃໝ່', en: 'Counter-offer' },
  counterMax: { lo: 'ສູງສຸດ {p}', en: 'Max {p}' },
  revisionsLeft: { lo: 'ປ່ຽນລາຄາໄດ້ອີກ {n} ຄັ້ງ', en: '{n} price changes left' },
  sendOffer: { lo: 'ສົ່ງລາຄາ', en: 'Send offer' },
  waitingPassenger: { lo: 'ລໍຖ້າຜູ້ໂດຍສານເລືອກ', en: 'Waiting for the passenger' },
  yourOffer: { lo: 'ລາຄາຂອງທ່ານ', en: 'Your offer' },
  withdraw: { lo: 'ຖອນລາຄາ', en: 'Withdraw' },
  changePrice: { lo: 'ປ່ຽນລາຄາ', en: 'Change price' },
  offerExpired: { lo: 'ລາຄາຂອງທ່ານໝົດເວລາແລ້ວ', en: 'This offer expired' },
  notSelected: { lo: 'ຜູ້ໂດຍສານເລືອກຄົນຂັບຄົນອື່ນ', en: 'Passenger chose another driver' },
  youGotRide: { lo: 'ທ່ານໄດ້ຖ້ຽວນີ້!', en: 'You got the ride!' },
  newRequest: { lo: 'ມີຄຳຂໍໃໝ່', en: 'New ride request' },
  popNewRequestBody: { lo: '{price} · {from} → {to}', en: '{price} · {from} → {to}' },
  popNewRequests: { lo: 'ມີ {n} ຄຳຂໍໃໝ່ໃກ້ທ່ານ', en: '{n} new ride requests nearby' },
  popGotRideBody: { lo: 'ໄປຮັບທີ່ {from}', en: 'Pick up at {from}' },
  popCancelledBody: { lo: '{who} ຍົກເລີກຖ້ຽວ', en: 'Cancelled by {who}' },
  err_offer_open_elsewhere: { lo: 'ທ່ານມີລາຄາທີ່ລໍຖ້າຢູ່ແລ້ວ', en: 'You already have an open offer' },
  err_offer_revision_limit: { lo: 'ປ່ຽນລາຄານີ້ບໍ່ໄດ້ອີກແລ້ວ', en: "You can't change this offer again" },
  err_offer_open: { lo: 'ກະລຸນາຖອນລາຄາກ່ອນ', en: 'Withdraw your offer first' },
  err_ride_not_found: { lo: 'ຄຳຂໍນີ້ບໍ່ມີແລ້ວ', en: 'This request is no longer available' },
  err_ride_not_cancellable: {
    lo: 'ຍົກເລີກຖ້ຽວນີ້ບໍ່ໄດ້ແລ້ວ; ຕິດຕໍ່ຝ່າຍຊ່ວຍເຫຼືອ',
    en: 'This trip can no longer be cancelled; contact support',
  },

  // trip (§6)
  trip: { lo: 'ຖ້ຽວ', en: 'Trip' },
  pickup: { lo: 'ຈຸດຮັບ', en: 'Pick-up' },
  destination: { lo: 'ປາຍທາງ', en: 'Destination' },
  st_driver_assigned: { lo: 'ກຳລັງໄປຮັບ', en: 'Heading to pick-up' },
  st_driver_arrived: { lo: 'ຮອດຈຸດຮັບແລ້ວ', en: 'At pick-up' },
  st_in_progress: { lo: 'ກຳລັງເດີນທາງ', en: 'On trip' },
  st_completed: { lo: 'ສຳເລັດແລ້ວ', en: 'Completed' },
  st_cancelled: { lo: 'ຍົກເລີກແລ້ວ', en: 'Cancelled' },
  btnArrived: { lo: 'ຮອດຈຸດຮັບແລ້ວ', en: "I've arrived" },
  btnStart: { lo: 'ເລີ່ມຖ້ຽວ', en: 'Start trip' },
  btnComplete: { lo: 'ຈົບຖ້ຽວ', en: 'Complete trip' },
  collectCash: { lo: 'ເກັບເງິນສົດ {p}', en: 'Collect {p} in cash' },
  collectCashConfirm: {
    lo: 'ຈົບຖ້ຽວ ແລະ ເກັບເງິນສົດ {p} ຈາກຜູ້ໂດຍສານ?',
    en: 'Complete the trip and collect {p} in cash from the passenger?',
  },
  call: { lo: 'ໂທ', en: 'Call' },
  navigate: { lo: 'ນຳທາງ', en: 'Navigate' },
  cancelTrip: { lo: 'ຍົກເລີກຖ້ຽວ', en: 'Cancel trip' },
  cancelReason: { lo: 'ເຫດຜົນທີ່ຍົກເລີກ', en: 'Why are you cancelling?' },
  note: { lo: 'ໝາຍເຫດ (ທາງເລືອກ)', en: 'Note (optional)' },
  confirmCancel: { lo: 'ຢືນຢັນຍົກເລີກ', en: 'Confirm cancel' },
  noShowIn: { lo: 'ໄດ້ໃນ {t}', en: 'Available in {t}' },
  cr_vehicle_issue: { lo: 'ລົດມີບັນຫາ', en: 'Vehicle issue' },
  cr_safety_concern: { lo: 'ບໍ່ປອດໄພ', en: 'Safety concern' },
  cr_passenger_no_show: { lo: 'ຜູ້ໂດຍສານບໍ່ມາ', en: 'Passenger did not show' },
  cr_other: { lo: 'ອື່ນໆ', en: 'Other' },
  noCancelInProgress: {
    lo: 'ຍົກເລີກບໍ່ໄດ້ລະຫວ່າງເດີນທາງ; ຕິດຕໍ່ຝ່າຍຊ່ວຍເຫຼືອ',
    en: 'A trip in progress cannot be cancelled; contact support',
  },
  tripCompleted: { lo: 'ຖ້ຽວສຳເລັດ', en: 'Trip completed' },
  tripCancelled: { lo: 'ຖ້ຽວຖືກຍົກເລີກ', en: 'Trip cancelled' },
  cancelledBy: { lo: 'ຍົກເລີກໂດຍ {who}', en: 'Cancelled by {who}' },
  by_passenger: { lo: 'ຜູ້ໂດຍສານ', en: 'the passenger' },
  by_driver: { lo: 'ທ່ານ', en: 'you' },
  by_admin: { lo: 'ຝ່າຍຊ່ວຍເຫຼືອ', en: 'support' },
  ratePassenger: { lo: 'ໃຫ້ຄະແນນຜູ້ໂດຍສານ', en: 'Rate passenger' },
  backToRequests: { lo: 'ກັບໄປຮັບວຽກ', en: 'Back to requests' },
  continueTrip: { lo: 'ສືບຕໍ່ຖ້ຽວ', en: 'Continue trip' },
  fare: { lo: 'ຄ່າໂດຍສານ', en: 'Fare' },
  cashToCollect: { lo: 'ເກັບເງິນສົດຈາກຜູ້ໂດຍສານ', en: 'Collect in cash' },
  requestedAt: { lo: 'ເວລາຂໍ', en: 'Requested' },
  cashOnly: { lo: 'ຈ່າຍເງິນສົດເທົ່ານັ້ນ', en: 'Cash only' },

  // rating (§7.1)
  rateTitle: { lo: 'ຜູ້ໂດຍສານເປັນແນວໃດ?', en: 'How was the passenger?' },
  commentPlaceholder: { lo: 'ຄຳເຫັນ (ທາງເລືອກ)', en: 'Comment (optional)' },
  tagsMax: { lo: 'ເລືອກໄດ້ສູງສຸດ 3', en: 'Pick up to 3' },
  tag_polite: { lo: 'ສຸພາບ', en: 'Polite' },
  tag_on_time: { lo: 'ຕົງເວລາ', en: 'On time' },
  tag_respectful: { lo: 'ໃຫ້ກຽດ', en: 'Respectful' },
  tag_rude: { lo: 'ບໍ່ສຸພາບ', en: 'Rude' },
  tag_late: { lo: 'ມາຊ້າ', en: 'Late' },
  tag_left_mess: { lo: 'ເຮັດເປື້ອນ', en: 'Left a mess' },
  thanksRating: { lo: 'ຂອບໃຈສຳລັບຄະແນນ', en: 'Thanks for rating' },

  // earnings / wallet / history (§7)
  tabHome: { lo: 'ວຽກ', en: 'Rides' },
  tabEarnings: { lo: 'ລາຍຮັບ', en: 'Earnings' },
  tabHistory: { lo: 'ປະຫວັດ', en: 'History' },
  tabAccount: { lo: 'ບັນຊີ', en: 'Account' },
  earnings: { lo: 'ລາຍຮັບ', en: 'Earnings' },
  wallet: { lo: 'ກະເປົາ', en: 'Wallet' },
  today: { lo: 'ມື້ນີ້', en: 'Today' },
  last7: { lo: '7 ມື້', en: '7 days' },
  thisMonth: { lo: 'ເດືອນນີ້', en: 'This month' },
  netEarning: { lo: 'ລາຍຮັບສຸດທິ', en: 'Net earnings' },
  commission: { lo: 'ຄ່ານາຍໜ້າ', en: 'Commission' },
  ridesN: { lo: '{n} ຖ້ຽວ', en: '{n} rides' },
  daily: { lo: 'ລາຍວັນ', en: 'By day' },
  tripsList: { lo: 'ລາຍການຖ້ຽວ', en: 'Trips' },
  youOwe: { lo: 'ທ່ານຄ້າງຈ່າຍ', en: 'You owe' },
  limit: { lo: 'ເພດານ {p}', en: 'Limit {p}' },
  walletBlocked: {
    lo: 'ທ່ານຮັບວຽກບໍ່ໄດ້ຈົນກວ່າຈະຊຳລະທີ່ຫ້ອງການ',
    en: 'You cannot receive rides until you pay at the office.',
  },
  walletEntries: { lo: 'ລາຍການເຄື່ອນໄຫວ', en: 'Activity' },
  we_commission: { lo: 'ຄ່ານາຍໜ້າ', en: 'Commission' },
  we_settlement: { lo: 'ຊຳລະທີ່ຫ້ອງການ', en: 'Paid at office' },
  we_adjustment: { lo: 'ປັບປຸງ', en: 'Adjustment' },
  all: { lo: 'ທັງໝົດ', en: 'All' },
  completed: { lo: 'ສຳເລັດ', en: 'Completed' },
  cancelled: { lo: 'ຍົກເລີກ', en: 'Cancelled' },
  noHistory: { lo: 'ຍັງບໍ່ມີຖ້ຽວ', en: 'No trips yet' },
  rideDetail: { lo: 'ລາຍລະອຽດຖ້ຽວ', en: 'Trip details' },

  // account & settings
  profile: { lo: 'ໂປຣໄຟລ໌', en: 'Profile' },
  settings: { lo: 'ຕັ້ງຄ່າ', en: 'Settings' },
  language: { lo: 'ພາສາ', en: 'Language' },
  apiBaseUrl: { lo: 'ທີ່ຢູ່ API (dev)', en: 'API base URL (dev)' },
  testConnection: { lo: 'ທົດສອບການເຊື່ອມຕໍ່', en: 'Test connection' },
  connectionOk: { lo: 'ເຊື່ອມຕໍ່ໄດ້', en: 'Connected' },
  realtimeLive: { lo: 'ອັບເດດທັນທີ', en: 'Live updates' },
  realtimePolling: { lo: 'ອັບເດດທຸກ 5 ວິ', en: 'Updating every 5 s' },
  pushOff: {
    lo: 'ການແຈ້ງເຕືອນ push ຕ້ອງໃຊ້ development build',
    en: 'Push notifications need a development build',
  },
  deviceId: { lo: 'ລະຫັດເຄື່ອງ', en: 'Device ID' },
};

let current = 'lo';

export const setLang = (lang) => {
  current = lang === 'en' ? 'en' : 'lo';
};
export const getLang = () => current;

/** t('key', { n: 3 }) — replaces {n}. Unknown keys return the key itself. */
export function t(key, vars) {
  const entry = STRINGS[key];
  let out = entry ? entry[current] || entry.lo : key;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** Lookup that falls back when the key is unknown (server enums may grow). */
export const tOr = (key, fallback, vars) => (STRINGS[key] ? t(key, vars) : fallback);

/* -----------------------------------------------------------------------------
   Money and time. Vientiane is UTC+7 all year (no DST), so shifting by 7 h and
   reading the UTC fields avoids depending on Intl time-zone data in Hermes.
   -------------------------------------------------------------------------- */

export const money = (n) => `${fmtNum(n || 0)} ₭`;

const VTE_OFFSET_MS = 7 * 3600 * 1000;
const pad = (n) => String(n).padStart(2, '0');
const vte = (iso) => new Date(new Date(iso).getTime() + VTE_OFFSET_MS);

export function fmtTime(iso) {
  if (!iso) return '';
  const d = vte(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = vte(iso);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${fmtTime(iso)}`;
}

/** "YYYY-MM-DD" in Vientiane, `daysAgo` days before now. */
export function vteDate(daysAgo = 0) {
  const d = vte(Date.now() - daysAgo * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** "2026-09-26" -> "26/09" for day rows. */
export const shortDay = (ymd) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}` : '');

/** m:ss countdown from milliseconds. */
export function countdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

export function fmtDistance(m) {
  if (m == null) return '';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
