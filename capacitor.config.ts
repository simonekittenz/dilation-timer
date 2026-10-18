import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.simonekittenz.dilationtimer',
	appName: 'Dilation timer',
	// the output of `npm run build:native`
	webDir: 'build',
	backgroundColor: '#fff0f6',
	plugins: {
		LocalNotifications: {
			// the small white bunny shown in the status bar next to an alert
			smallIcon: 'ic_stat_bunny',
			iconColor: '#FF4F9A'
		}
	}
};

export default config;
