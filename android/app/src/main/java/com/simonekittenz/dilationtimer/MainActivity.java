package com.simonekittenz.dilationtimer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // our own plugin, registered before the bridge starts
        registerPlugin(AudioDuckingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
