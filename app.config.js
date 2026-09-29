// Adds the Firebase files for push (DRIVER_APP_API.md §9.1) only when they are
// present, so the app still builds and runs in Expo Go without them.
const fs = require('fs');

module.exports = ({ config }) => {
  if (fs.existsSync('./google-services.json')) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  if (fs.existsSync('./GoogleService-Info.plist')) {
    config.ios = { ...config.ios, googleServicesFile: './GoogleService-Info.plist' };
  }
  return config;
};
