package com.simonekittenz.dilationtimer;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The timer on the lock screen while a session is running: one quiet, ongoing notification with a
 * clock that Android itself counts down (or up), so it keeps ticking while the app is asleep.
 * On Android 16 and newer it asks to be promoted to a Live Update (a chip in the status bar and a card
 * on the lock screen); on older versions it is simply an ongoing notification.
 *
 * It makes no sound: the alerts for a timer ending are the separate notifications from the
 * local-notifications plugin. This one is only taken down by the app, or by itself when its time is up.
 */
@CapacitorPlugin(name = "SessionNotice")
public class SessionNoticePlugin extends Plugin {

    static final String CHANNEL_ID = "dt-session-v1";
    /** Outside the range the alerts use (41000 and up), so cancelling alerts never touches it. */
    static final int NOTICE_ID = 40_900;

    private static final int PINK = 0xFFFF4F9A;

    /** Shows the notice, or replaces the one that is up. */
    @PluginMethod
    public void show(PluginCall call) {
        final String title = call.getString("title");
        final String text = call.getString("text", "");
        final String clock = call.getString("clock", "none");
        // optLong accepts a whole number of any size (getLong only takes the very large ones)
        final long at = call.getData().optLong("at", 0);
        final long expiresInMs = call.getData().optLong("expiresInMs", 0);
        if (title == null || title.isEmpty()) {
            call.reject("A title is needed");
            return;
        }
        final Context context = getContext();
        if (!canPost(context)) {
            // notifications are off for the app: nothing to show, and nothing wrong either
            call.resolve();
            return;
        }
        ensureChannel(context);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_bunny)
            .setColor(PINK)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openAppIntent(context));

        if (("down".equals(clock) || "up".equals(clock)) && at > 0) {
            builder
                .setShowWhen(true)
                .setWhen(at)
                .setUsesChronometer(true)
                .setChronometerCountDown("down".equals(clock));
        } else {
            builder.setShowWhen(false);
        }
        if (expiresInMs > 0) builder.setTimeoutAfter(expiresInMs);

        if (Build.VERSION.SDK_INT >= 36) {
            // Android 16: ask to be shown as a Live Update (the user can turn this off for the app)
            Bundle extras = new Bundle();
            extras.putBoolean("android.requestPromotedOngoing", true);
            builder.addExtras(extras);
        }

        NotificationManagerCompat.from(context).notify(NOTICE_ID, builder.build());
        call.resolve();
    }

    /** Takes the notice down. */
    @PluginMethod
    public void hide(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(NOTICE_ID);
        call.resolve();
    }

    private static boolean canPost(Context context) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= 33) {
            return (
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
            );
        }
        return true;
    }

    private static PendingIntent openAppIntent(Context context) {
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open == null) open = new Intent();
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        return PendingIntent.getActivity(
            context,
            0,
            open,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
    }

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Session timer",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("The timer of a running session, on your lock screen");
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.setShowBadge(false);
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }
}
