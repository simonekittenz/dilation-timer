package com.simonekittenz.dilationtimer;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.regex.Pattern;

/**
 * Plays the alarm sounds from files bundled with the web app and, while they play, asks Android
 * to lower other apps' audio (Spotify, podcasts...) instead of stopping it. When the alarm ends
 * the other audio goes back to normal volume by itself.
 */
@CapacitorPlugin(name = "AudioDucking")
public class AudioDuckingPlugin extends Plugin {

    private static final String TAG = "AudioDucking";

    private static final Pattern SAFE_NAME = Pattern.compile("^[a-z0-9-]+$");

    private final Handler main = new Handler(Looper.getMainLooper());
    private final AudioAttributes attributes = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build();
    // we play the alarm whether or not the other app lets go of the audio, so nothing to do here
    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {};

    private MediaPlayer player;
    private AudioFocusRequest focusRequest; // Android 8+
    private boolean hasFocus = false;
    private Runnable loopTask;

    /** Plays a bundled sound once. Resolves as soon as it has started. */
    @PluginMethod
    public void play(PluginCall call) {
        final String sound = soundName(call);
        if (sound == null) return;
        final float volume = volume(call);
        Log.d(TAG, "play " + sound + " requested");
        main.post(() -> {
            try {
                cancelLoop();
                start(sound, volume);
                call.resolve();
            } catch (Exception e) {
                call.reject("Couldn't play the alarm sound", e);
            }
        });
    }

    /** Plays a sound now and again every intervalMs until stop(). */
    @PluginMethod
    public void loop(PluginCall call) {
        final String sound = soundName(call);
        if (sound == null) return;
        final float volume = volume(call);
        final long intervalMs = Math.max(500, call.getInt("intervalMs", 2500));
        Log.d(TAG, "loop " + sound + " requested, every " + intervalMs + " ms");
        main.post(() -> {
            try {
                cancelLoop();
                start(sound, volume);
                loopTask = new Runnable() {
                    @Override
                    public void run() {
                        try {
                            start(sound, volume);
                        } catch (Exception ignored) {
                            // keep trying on the next round
                        }
                        main.postDelayed(this, intervalMs);
                    }
                };
                main.postDelayed(loopTask, intervalMs);
                call.resolve();
            } catch (Exception e) {
                call.reject("Couldn't play the alarm sound", e);
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> {
            cancelLoop();
            releasePlayer();
            abandonFocus();
            call.resolve();
        });
    }

    // --- helpers -----------------------------------------------------------------------------

    /** Only simple names are allowed, so a bad value can't point at other files. Rejects the call itself. */
    private String soundName(PluginCall call) {
        String name = call.getString("sound");
        if (name == null || !SAFE_NAME.matcher(name).matches()) {
            call.reject("Unknown alarm sound");
            return null;
        }
        return name;
    }

    private float volume(PluginCall call) {
        double v = call.getDouble("volume", 1.0);
        return (float) Math.max(0.0, Math.min(1.0, v));
    }

    private void start(String sound, float volume) throws Exception {
        requestFocus();
        releasePlayer();
        MediaPlayer next = new MediaPlayer();
        try {
            // the web app's files live under assets/public (see `npx cap sync`)
            try (AssetFileDescriptor afd = getContext().getAssets().openFd("public/sounds/" + sound + ".wav")) {
                next.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            }
            next.setAudioAttributes(attributes);
            next.setVolume(volume, volume);
            next.setOnCompletionListener(mp -> {
                mp.release();
                if (player == mp) player = null;
                // hand the audio back as soon as a sound ends; the next repeat asks for it again
                abandonFocus();
            });
            next.prepare();
            next.start();
            player = next;
            Log.d(TAG, "playing " + sound + " at volume " + volume);
        } catch (Exception e) {
            next.release();
            throw e;
        }
    }

    private void cancelLoop() {
        if (loopTask != null) {
            main.removeCallbacks(loopTask);
            loopTask = null;
        }
    }

    private void releasePlayer() {
        if (player != null) {
            try {
                player.release();
            } catch (Exception ignored) {
                // already released
            }
            player = null;
        }
    }

    private AudioManager audioManager() {
        return (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    /** Asks other apps to lower their volume while we play. */
    @SuppressWarnings("deprecation")
    private void requestFocus() {
        AudioManager am = audioManager();
        if (am == null || hasFocus) return;
        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener(focusListener)
                .build();
            result = am.requestAudioFocus(focusRequest);
        } else {
            result = am.requestAudioFocus(
                focusListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            );
        }
        hasFocus = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        Log.d(TAG, "audio focus request " + (hasFocus ? "granted" : "NOT granted (result " + result + ")"));
    }

    /** Lets the other app's audio return to normal volume. */
    @SuppressWarnings("deprecation")
    private void abandonFocus() {
        AudioManager am = audioManager();
        if (am == null || !hasFocus) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (focusRequest != null) am.abandonAudioFocusRequest(focusRequest);
        } else {
            am.abandonAudioFocus(focusListener);
        }
        hasFocus = false;
    }
}
