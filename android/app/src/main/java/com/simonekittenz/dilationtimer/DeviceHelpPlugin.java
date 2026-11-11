package com.simonekittenz.dilationtimer;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;

/**
 * Helps with phones that put apps to sleep to save battery (Samsung, Xiaomi, Oppo, OnePlus, Huawei...):
 * there, locked-screen alerts can come late or not at all unless the battery limits are off for the app.
 * It only reads two facts and opens the app's own page in the system settings; it changes nothing itself.
 */
@CapacitorPlugin(name = "DeviceHelp")
public class DeviceHelpPlugin extends Plugin {

    /** Who made the phone, and whether the system leaves this app out of its battery limits. */
    @PluginMethod
    public void info(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        result.put(
            "manufacturer",
            Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase(Locale.ROOT)
        );
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        result.put(
            "unrestricted",
            power != null && power.isIgnoringBatteryOptimizations(context.getPackageName())
        );
        call.resolve(result);
    }

    /** Opens this app's page in the system settings, where the Battery setting lives. */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", context.getPackageName(), null)
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            context.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Couldn't open the settings", e);
        }
    }
}
