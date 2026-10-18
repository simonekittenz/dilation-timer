import release from './appRelease.json';

/** The version this copy of the app was built as (written by `npm run apk` before the build). */
export const APP_VERSION: string = release.android.version;
export const APP_VERSION_CODE: number = release.android.versionCode;
