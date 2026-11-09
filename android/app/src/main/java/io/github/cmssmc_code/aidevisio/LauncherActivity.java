package io.github.cmssmc_code.aidevisio;

import com.google.androidbrowserhelper.trusted.TwaLauncher;

public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected TwaLauncher.FallbackStrategy getFallbackStrategy() {
        return WebFallbackActivity.FALLBACK_STRATEGY;
    }
}
