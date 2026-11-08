const { withAndroidManifest } = require('expo/config-plugins');
module.exports = function withBoardBackground(config) {
  return withAndroidManifest(config, result => {
    const application = result.modResults.manifest.application[0];
    const services = application.service ?? (application.service = []);
    const name = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';
    let service = services.find(item => item.$['android:name'] === name);
    if (!service) { service = { $: { 'android:name': name } }; services.push(service); }
    service.$['android:foregroundServiceType'] = 'connectedDevice';
    service.$['android:exported'] = 'false';
    return result;
  });
};
